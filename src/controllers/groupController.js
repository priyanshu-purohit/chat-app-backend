const { getReceiverSocketId } = require('../config/socket');
const Group = require('../models/Group');
const Message = require('../models/Message');
const User = require('../models/User');
const { sendPushNotification } = require('./messageController');


// @desc    Create a new group
// @route   POST /api/groups
const createGroup = async (req, res) => {
    try {
        const { name, description, members } = req.body;
        const currentUserId = req.user._id;

        const groupMembers = Array.isArray(members) ? [...members] : [];

        if (!groupMembers.includes(currentUserId.toString())) {
            groupMembers.push(currentUserId);
        }

        const newGroup = await Group.create({
            name,
            description,
            members: groupMembers,
            admins: [currentUserId],
            createdBy: currentUserId
        });

        res.status(201).json(newGroup);
    }
    catch (error) {
        res.status(500).json({ message: 'Error creating group', error: error.message });
    }
};

// @desc    Send a message to a group
// @route   POST /api/groups/:id/send
const sendGroupMessage = async (req, res) => {
    try {
        const groupId = req.params.id;
        const { content } = req.body;
        const senderId = req.user._id;

        if (!content || content.trim() === '') {
            return res.status(400).json({ message: 'Message content cannot be empty' });
        }
        // Check if group exists
        const group = await Group.findById(groupId);
        if (!group) {
            return res.status(404).json({ message: 'Group not found' });
        }
        // Security check: Verify sender is a member of the group
        if (!group.members.includes(senderId)) {
            return res.status(403).json({ message: 'You are not a member of this group' });
        }

        const newMessage = await Message.create({
            sender: senderId,
            group: groupId,
            content: content,
        });

        // Broadcast to the Socket.io room representing this group
        const io = req.app.get("io");
        io.to(groupId.toString()).emit("new_group_message", newMessage);


        // Send push notifications to group members
        const sender = await User.findById(senderId);

        const receivers = await User.find({
            _id: { $in: group.members.filter((id) => id.toString() !== senderId.toString()) }
        }).select('+fcmToken');

        await Promise.all(
            receivers.map(async (receiver) => {
                const socketId = getReceiverSocketId(receiver._id.toString());

                if (!socketId && receiver.fcmToken) {
                    await sendPushNotification(sender, receiver, content, group.name);
                }
            })
        );

        console.log(`📢 Group message emitted to Room ${groupId}`);
        res.status(201).json(newMessage);
    }
    catch (error) {
        res.status(500).json({ message: 'Error sending group message', error: error.message });
    }
}

// @desc    Get group chat history (Cursor-based pagination)
// @route   GET /api/groups/:id/messages
const getGroupMessages = async (req, res) => {
    try {
        const groupId = req.params.id;
        const currentUserId = req.user._id;
        const limit = parseInt(req.query.limit, 10) || 20;
        const cursor = req.query.cursor;


        const group = await Group.findById(groupId);
        if (!group) {
            return res.status(404).json({ message: 'Group not found' });
        }

        if (!group.members.includes(currentUserId)) {
            return res.status(403).json({ message: 'You are not a member of this group' });
        }

        const query = { group: groupId };

        if (cursor) {
            query._id = { $lt: cursor };
        }

        const messages = await Message.find(query)
            .sort({ createdAt: -1 })
            .limit(limit + 1)


        let hasNextPage = false;
        let nextCursor = null;

        if (messages.length > limit) {
            hasNextPage = true;
            const nextMessage = messages.pop();
            nextCursor = nextMessage._id;
        }

        return res.status(201).json({
            messages,
            nextCursor,
            hasNextPage,
        })
    }
    catch (error) {
        res.status(500).json({ message: 'Error fetching group messages', error: error.message });
    }
}


// @desc    Add a member to a group (Admin only)
// @route   POST /api/groups/:id/members/add
const addMember = async (req, res) => {
    try {
        const groupId = req.params.id;
        const { userId } = req.body;
        const currentUserId = req.user._id;

        const group = await Group.findById(groupId);

        if (!group) return res.status(404).json({ message: 'Group not found' });

        // Admin verification
        if (!group.admins.includes(currentUserId)) {
            return res.status(403).json({ message: 'Only admins can add members' });
        }

        // Check if user is already a member
        if (group.members.includes(userId)) {
            return res.status(400).json({ message: 'User is already a member' });
        }

        group.members.push(userId);
        await group.save();
        res.status(200).json({ message: 'Member added successfully', group });
    } catch (error) {
        res.status(500).json({ message: 'Error adding member', error: error.message });
    }
};



// @desc    Remove a member from a group (Admin only)
// @route   POST /api/groups/:id/members/remove

const removeMember = async (req, res) => {
    try {
        const groupId = req.params.id;
        const { userId } = req.body;
        const currentUserId = req.user._id;

        const group = await Group.findById(groupId);

        if (!group) return res.status(404).json({ message: 'Group not found' });

        if (!group.admins.includes(currentUserId)) {
            return res.status(403).json({ message: 'Only admins can remove members' });
        }

        // Remove from members and admins array
        group.members = group.members.filter((id) => id.toString() !== userId);
        group.admins = group.admins.filter((id) => id.toString() !== userId);
        await group.save();
        res.status(200).json({ message: 'Member removed successfully', group });

    } catch (error) {
        res.status(500).json({ message: 'Error removing member', error: error.message });

    }
};


module.exports = {
    createGroup,
    sendGroupMessage,
    getGroupMessages,
    addMember,
    removeMember
}