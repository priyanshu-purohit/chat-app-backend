const { getReceiverSocketId } = require("../config/socket");
const Message = require("../models/Message");
const User = require("../models/User");


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

        const receiver = await User.findById(receiverId);

        if (!receiver) {
            return res.status(404).json({ message: 'Receiver not found' });
        }

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
            io.to(receiverSocketId).emit('new_message', newMessage);
        }

        console.log(`✉️ Real-time message emitted from ${senderId} to socket ${receiverSocketId}`);

        return res.status(201).json({
            success: true,
            message: 'Message sent successfully',
            data: newMessage,
        });
    } catch (error) {
        res.status(500).json({ message: 'Error sending message', error: error.message });
    }
}

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
            io.to(message.group.toString()).emit('message_deleted', { messageId });
        } else {
            // Direct message deletion
            const receiverSocketId = getReceiverSocketId(message.receiver.toString());
            if (receiverSocketId) {
                io.to(receiverSocketId).emit('message_deleted', { messageId });
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

        // Check if this user has already reacted with this exact emoji
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
        const eventData = { messageId, reactions: message.reactions };
        if (message.group) {
            // Group reaction emit
            io.to(message.group.toString()).emit('message_reaction', eventData);
        } else {
            // Direct reaction emit (to receiver and sender)
            const receiverSocketId = getReceiverSocketId(message.receiver.toString());
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
    getMessages,
    markAsRead,
    editMessage,
    deleteMessage,
    toggelReaction
};