const Group = require("../models/Group");
const User = require("../models/User");



// @desc    Toggle block/unblock a user
// @route   POST /api/users/block/:id

const toggleBlockUser = async (req, res) => {
    try {
        const targetUserId = req.params.id;
        const currentUserId = req.user._id;

        if (targetUserId === currentUserId.toString()) {
            return res.status(400).json({ message: 'You cannot block yourself' });
        }

        const currentUser = await User.findById(currentUserId);
        const targetUser = await User.findById(targetUserId);

        if (!targetUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        const isBlocked = currentUser.blockedUsers.includes(targetUserId);

        if (isBlocked) {
            // Unblock: Remove from array
            currentUser.blockedUsers = currentUser.blockedUsers.filter(
                (id) => id.toString() !== targetUserId
            );
            await currentUser.save();
            return res.status(200).json({ message: 'User unblocked successfully', blockedUsers: currentUser.blockedUsers });
        }
        else {
            // Block: Add to array
            currentUser.blockedUsers.push(targetUserId);
            await currentUser.save();
            return res.status(200).json({ message: 'User blocked successfully', blockedUsers: currentUser.blockedUsers });
        }
    } catch (error) {
        res.status(500).json({ message: 'Error toggling block status', error: error.message });
    }
};

// @desc    Toggle mute/unmute a user
// @route   POST /api/users/mute/:id

const toggleMuteUser = async (req, res) => {
    try {
        const targetUserId = req.params.id;
        const currentUserId = req.user._id;

        const currentUser = await User.findById(currentUserId);

        const isMuted = currentUser.mutedUsers.includes(targetUserId);

        if (isMuted) {
            currentUser.mutedUsers = currentUser.mutedUsers.filter((id) =>
                id.toString() !== targetUserId
            );
            await currentUser.save();
            return res.status(200).json({ message: 'User unmuted successfully', mutedUsers: currentUser.mutedUsers });
        }
        else {
            currentUser.mutedUsers.push(targetUserId);
            await currentUser.save();
            return res.status(200).json({ message: 'User muted successfully', mutedUsers: currentUser.mutedUsers });
        }
    }
    catch (error) {
        res.status(500).json({ message: 'Error toggling mute status', error: error.message });
    }
};

// @desc    Toggle mute/unmute a group
// @route   POST /api/users/mute-group/:id
const toggleMuteGroup = async (req, res) => {
    try {
        const groupId = req.params.id;
        const currentUserId = req.user._id;

        const group = await Group.findById(groupId);
        if (!group) return res.status(404).json({ message: 'Group not found' });

        const currentUser = await User.findById(currentUserId);
        
        const isMuted = currentUser.mutedGroups.includes(groupId);

        if (isMuted) {
            currentUser.mutedGroups = currentUser.mutedGroups.filter(
                (id) => id.toString() !== groupId
            );
            await currentUser.save();
            return res.status(200).json({ message: 'Group unmuted successfully', mutedGroups: currentUser.mutedGroups });
        } 
        else {
            currentUser.mutedGroups.push(groupId);
            await currentUser.save();
            return res.status(200).json({ message: 'Group muted successfully', mutedGroups: currentUser.mutedGroups });
        }

    } 
    catch (error) {
        res.status(500).json({ message: 'Error toggling group mute status', error: error.message });
    }
};

// @desc update FCM token for a user
// @route POST /api/users/fcm-token

const updateFCMToken = async (req, res) => {
    try {
        const userId = req.user._id;
        const { token } = req.body;

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                message: 'User not found',
            });
        }

        user.fcmToken = token;
        await user.save();

        return res.status(200).json({
            message: 'FCM token updated successfully'
        });
    }
    catch (error) {
        res.status(500).json({
            message: 'Error updating FCM token',
            error: error.message,
        });
    }
};

module.exports = {
    toggleBlockUser,
    toggleMuteUser,
    toggleMuteGroup,
    updateFCMToken,
};

