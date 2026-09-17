const { getReceiverSocketId } = require("../config/socket");
const Message = require("../models/Message");
const User = require("../models/User");
const admin = require("../config/firebase");
const Group = require("../models/Group");

const sendPushNotification = async (sender, receiver, content, groupName = null) => {
    try {
        const senderName = sender.username;
        const title = groupName ? groupName : senderName;
        const body = groupName ? `${senderName}: ${content}` : content;

        await admin.messaging().send({
            token: receiver.fcmToken,
            notification: {
                title,
                body,
            },
        });
    }
    catch (error) {
        if (
            error.code === "messaging/registration-token-not-registered" ||
            error.code === "messaging/invalid-registration-token"
        ) {
            receiver.fcmToken = null;
            await receiver.save();
        }

        console.error("❌Failed to send FCM notification:", error);
    }
};


// @desc    Send a message to a user
// @route   POST /api/messages/send/:id
const sendMessage = async (req, res) => {
    try {
        const { content } = req.body;
        const receiverId = req.params.id;
        const senderId = req.user._id;

        if (!content || content.trim() === '') {
            return res.status(400).json({ message: 'Message content cannot be empty' });
        }

        const receiver = await User.findById(receiverId).select('+fcmToken');
        const sender = await User.findById(senderId);

        if (!receiver) {
            return res.status(404).json({ message: 'Receiver not found' });
        }


        // Has the receiver blocked the sender?
        if (receiver.blockedUsers.includes(senderId)) {
            return res.status(403).json({ message: 'You have been blocked by this user' });
        }
        // Has the sender blocked the receiver?
        if (sender.blockedUsers.includes(receiverId)) {
            return res.status(400).json({ message: 'You cannot send messages to a user you have blocked' });
        }

        const isMuted = receiver.mutedUsers.includes(senderId);

        // Save message to MongoDB
        const newMessage = await Message.create({
            sender: senderId,
            receiver: receiverId,
            content: content,
            replyTo: req.body.replyTo || null
        });

        const io = req.app.get('io');

        const receiverSocketId = getReceiverSocketId(receiverId);

        if (receiverSocketId) {
            io.to(receiverSocketId).emit('new_message', {
                ...newMessage.toJSON(),
                isMuted: isMuted
            });
        }
        else if (receiver.fcmToken) {
            await sendPushNotification(sender, receiver, content);
        }

        console.log(`✉️ Real-time message emitted from ${senderId} to socket ${receiverSocketId} (Muted: ${isMuted})`);



        return res.status(201).json({
            success: true,
            message: 'Message sent successfully',
            data: newMessage,
        });
    }
    catch (error) {
        res.status(500).json({ message: 'Error sending message', error: error.message });
    }
}

// @desc    Get active direct and group conversations for the logged in user
// @route   GET /api/messages/conversations

const getConversations = async (req, res) => {
    try {
        const currentUserId = req.user._id;

        // 1. Fetch all groups the user is a member of
        const groups = await Group.find({ members: currentUserId });

        const groupIds = groups.map(g => g._id);

        // 2. Fetch the latest direct messages per conversation (aggregated)
        const directMessageAgg = await Message.aggregate([
            {
                $match: {
                    $or: [
                        { sender: currentUserId, group: { $exists: false } },
                        { receiver: currentUserId, group: { $exists: false } }
                    ]
                }
            },

            {
                $sort: { createdAt: -1 }
            },
            {
                $group: {
                    _id: {
                        $cond: [
                            { $eq: ["$sender", currentUserId] },
                            "$receiver",
                            "$sender"
                        ]
                    },
                    lastMessage: { $first: "$$ROOT" }
                }
            }
        ]);

        // 3. Fetch the latest group messages per group (aggregated)
        const groupMessageAgg = await Message.aggregate([
            {
                $match: {
                    group: { $in: groupIds }
                }
            },
            {
                $sort: { createdAt: -1 }
            },
            {
                $group: {
                    _id: "$group",
                    lastMessage: { $first: "$$ROOT" }
                }
            }
        ]);

        // 4. Get unread message counts for direct messages (aggregated)
        const unreadCountsAgg = await Message.aggregate([
            {
                $match: {
                    receiver: currentUserId,
                    status: { $ne: 'Read' },
                    group: { $exists: false }
                }
            },
            {
                $group: {
                    _id: "$sender",
                    count: { $sum: 1 }
                }
            }
        ]);

        const unreadCountsMap = new Map();
        unreadCountsAgg.forEach(item => {
            unreadCountsMap.set(item._id.toString(), item.count);
        });

        // 5. Fetch participants' user profiles in bulk (N+1 query optimization)
        const otherUserIds = directMessageAgg.map(item => item._id);

        const users = await User.find({ _id: { $in: otherUserIds } }).select('username avatar status lastactive');

        const usersMap = new Map();

        users.forEach(u => {
            usersMap.set(u._id.toString(), u);
        });

        // 6. Build direct conversations
        const directConversations = directMessageAgg.map(item => {
            const otherUserIdStr = item._id.toString();
            const participant = usersMap.get(otherUserIdStr);

            // If participant profile is not found (e.g. deleted user), skip
            if (!participant) return null;

            return {
                id: otherUserIdStr,
                type: 'direct',
                participant,
                lastMessage: item.lastMessage,
                unreadCount: unreadCountsMap.get(otherUserIdStr) || 0,
                updatedAt: item.lastMessage.createdAt
            };
        }).filter(c => c !== null);

        // 7. Build group conversations
        const groupMessagesMap = new Map();

        groupMessageAgg.forEach(item => {
            groupMessagesMap.set(item._id.toString(), item.lastMessage);
        });

        const groupMembersAgg = await Group.aggregate([
            {
                $match: {
                    _id: { $in: groupIds }
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'members',
                    foreignField: '_id',
                    as: 'members',
                }
            },
            {
                $project: {
                    _id: 1,
                    members: {
                        _id: 1,
                        username: 1,
                        avatar: 1,
                    },
                    admins: 1,
                }
            },
        ]);

        const groupMembersMap = new Map();

        groupMembersAgg.forEach(g => {
            groupMembersMap.set(g._id.toString(), g.members);
        });

        const groupConversations = groups.map(group => {
            const groupIdStr = group._id.toString();
            const lastMessage = groupMessagesMap.get(groupIdStr) || null;
            const members = groupMembersMap.get(groupIdStr) || [];

            return {
                id: groupIdStr,
                type: 'group',
                group: {
                    _id: group._id,
                    name: group.name,
                    description: group.description,
                    avatar: group.avatar,
                    members: members,
                    admins: group.admins,
                },
                lastMessage,
                unreadCount: 0, //simplified for groups
                updatedAt: lastMessage ? lastMessage.createdAt : group.createdAt
            };
        });



        // 8. Combine and sort all conversations by updatedAt descending
        const allConversations = [...directConversations, ...groupConversations].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

        res.status(200).json({
            success: true,
            conversations: allConversations
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching conversation list',
            error: error.message
        });
    }
};

// @desc    get message from a user
// @route   GET /api/messages/:id
const getMessages = async (req, res) => {
    try {
        const chatPartnerId = req.params.id;
        const currentUserId = req.user._id;
        // Parse query params (limit and cursor)
        const limit = parseInt(req.query.limit, 10) || 20;
        const cursor = req.query.cursor; // This will be a Message ObjectId string
        // Base query: Fetch messages between the two users
        const query = {
            $or: [
                { sender: currentUserId, receiver: chatPartnerId },
                { sender: chatPartnerId, receiver: currentUserId },
            ],
        };
        // If a cursor is provided, fetch messages older than the cursor
        if (cursor) {
            query._id = { $lt: cursor };
        }
        // Fetch limit + 1 messages so we know if there is a next page
        const messages = await Message.find(query)
            .sort({ createdAt: -1 }) // Get newest messages first
            .limit(limit + 1)
            .populate('replyTo', 'content sender');

        // Check if there is a next page of older messages
        let hasNextPage = false;
        let nextCursor = null;
        if (messages.length > limit) {
            hasNextPage = true;
            // The extra (+1) message is not sent to the client, but its ID becomes the next cursor
            const nextMessage = messages.pop();
            nextCursor = nextMessage._id;
        }
        res.status(200).json({
            messages,
            nextCursor,
            hasNextPage,
        });

    } catch (error) {
        res.status(500).json({ message: 'Error fetching messages', error: error.message });
    }
};


// @desc    Mark messages from a specific sender as read
// @route   PATCH /api/messages/read/:id
const markAsRead = async (req, res) => {
    try {
        const senderId = req.params.id;
        const currentUserId = req.user._id;

        const result = await Message.updateMany({
            sender: senderId,
            receiver: currentUserId,
            status: { $ne: 'Read' }
        }, {
            status: 'Read'
        });


        if (result.modifiedCount > 0) {
            const io = req.app.get('io');
            const senderSocketId = getReceiverSocketId(senderId);

            if (senderSocketId) {
                io.to(senderSocketId).emit("message_read", {
                    readerId: currentUserId
                })
            }
            console.log(`👁️ Read receipt emitted: ${currentUserId} read messages from ${senderId}`);
        }

        res.status(200).json({
            success: true,
            message: 'Messages marked as read',
            modifiedCount: result.modifiedCount
        });

    }
    catch (error) {
        res.status(500).json({ message: 'Error marking messages as read', error: error.message });
    }
};

// @desc    Edit a message
// @route   PATCH /api/messages/:id
const editMessage = async (req, res) => {
    try {
        const messageId = req.params.id;
        const currentUserId = req.user._id;

        const { content } = req.body;

        if (!content || content.trim() === '') {
            return res.status(400).json({ message: 'Message content cannot be empty' });
        }

        const message = await Message.findById(messageId);

        if (!message) {
            return res.status(404).json({ message: 'Message not found' });
        }

        // Security check: Only the sender can edit
        if (message.sender.toString() !== currentUserId.toString()) {
            return res.status(403).json({ message: 'You can only edit your own messages' });
        }

        // Update fields
        message.content = content;
        message.isEdited = true;
        await message.save();

        const io = req.app.get('io');

        if (message.group) {
            io.to(message.group).emit('message_edited', message);
        }
        else {
            const receiverSocketId = getReceiverSocketId(message.receiver.toString());
            if (receiverSocketId) {
                io.to(receiverSocketId).emit("message_edited", message);
            }
        }

        res.status(200).json(message);
    } catch (error) {
        res.status(500).json({ message: 'Error editing message', error: error.message });
    }
};

// @desc    Delete a message (Unsend)
// @route   DELETE /api/messages/:id
const deleteMessage = async (req, res) => {
    try {
        const messageId = req.params.id;
        const currentUserId = req.user._id;
        const message = await Message.findById(messageId);
        if (!message) {
            return res.status(404).json({ message: 'Message not found' });
        }
        // Security check: Only the sender can delete
        if (message.sender.toString() !== currentUserId.toString()) {
            return res.status(403).json({ message: 'You can only delete your own messages' });
        }
        await Message.findByIdAndDelete(messageId);
        // Emit deletion update via WebSockets
        const io = req.app.get('io');

        if (message.group) {
            // Group message deletion
            io.to(message.group.toString()).emit('message_deleted', { messageId, sender: message.sender, receiver: message.receiver, group: message.group });
        } else {
            // Direct message deletion
            const receiverSocketId = getReceiverSocketId(message.receiver.toString());
            if (receiverSocketId) {
                io.to(receiverSocketId).emit('message_deleted', { messageId, sender: message.sender, receiver: message.receiver, group: message.group });
            }
        }
        res.status(200).json({ success: true, message: 'Message deleted successfully', messageId });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting message', error: error.message });
    }
};

// @desc    Toggle emoji reaction on a message (Add/Remove)
// @route   POST /api/messages/:id/react

const toggelReaction = async (req, res) => {
    try {
        const messageId = req.params.id;
        const userId = req.user._id;
        const { emoji } = req.body;


        if (!emoji) {
            return res.status(400).json({ message: 'Emoji is required' });
        }

        const message = await Message.findById(messageId);

        if (!message) {
            return res.status(404).json({ message: "Message not found" })
        }

        // Check if this user has already reacted with this exact emoji(need to be reviewed when group feature adds in the frontend)
        const existingReactionIndex = message.reactions.findIndex(
            (r) => r.user.toString() === userId.toString() && r.emoji === emoji
        );
        if (existingReactionIndex > -1) {
            // Reaction exists -> Remove it (Toggle Off)
            message.reactions.splice(existingReactionIndex, 1);
        } else {
            // Reaction doesn't exist -> Add it (Toggle On)
            message.reactions.push({ user: userId, emoji });
        }

        await message.save();

        const io = req.app.get('io');
        const eventData = { messageId, sender: message.sender, receiver: message.receiver, group: message.group, reactions: message.reactions };
        if (message.group) {
            // Group reaction emit
            io.to(message.group.toString()).emit('message_reaction', eventData);
        } else {
            // Direct reaction emit (to receiver and sender)
            const receiverSocketId = getReceiverSocketId(message.sender.toString());
            if (receiverSocketId) {
                io.to(receiverSocketId).emit('message_reaction', eventData);
            }
        }
        res.status(200).json({ success: true, reactions: message.reactions });
    } catch (error) {
        res.status(500).json({ message: 'Error toggling reaction', error: error.message });
    }
};

module.exports = {
    sendMessage,
    getConversations,
    getMessages,
    markAsRead,
    editMessage,
    deleteMessage,
    toggelReaction,
    sendPushNotification
};