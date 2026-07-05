const Message = require("../models/Message");
const User = require("../models/User");
const cloudinary = require('../config/cloudinary');
const streamifier = require('streamifier');
const { getReceiverSocketId } = require('../config/socket');

const getResourceType = (mimetype) => {
    if (mimetype.startsWith('image/')) return 'image';
    if (mimetype.startsWith('video/')) return 'video';
    if (mimetype.startsWith('audio/')) return 'audio';
    return 'raw'; // For PDFs, Word documents, etc.
};

const uploadToCloudinary = (buffer, resourceType) => {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                resource_type: resourceType,
                folder: 'chat-app', // Organizes uploads in a folder in your Cloudinary account
            },
            (error, result) => {
                if (error) return reject(error);
                resolve(result);
            }
        );
        // Pipe the in-memory buffer into the Cloudinary upload stream
        streamifier.createReadStream(buffer).pipe(uploadStream);
    });
};


// @desc    Send a media message (image, video, audio, document)
// @route   POST /api/media/send/:id

const sendMediaMessage = async (req, res) => {
    try {
        const receiverId = req.params.id;
        const senderId = req.user._id;
        const caption = req.body.caption || ''; // Optional text caption
        // Multer ensures req.file is populated
        if (!req.file) {
            return res.status(400).json({ message: 'No file provided' });
        }
        // Verify receiver exists
        const receiver = await User.findById(receiverId);
        if (!receiver) {
            return res.status(404).json({ message: 'Receiver not found' });
        }
        // Check block status
        const sender = await User.findById(senderId);
        if (receiver.blockedUsers.includes(senderId)) {
            return res.status(403).json({ message: 'You have been blocked by this user' });
        }
        if (sender.blockedUsers.includes(receiverId)) {
            return res.status(400).json({ message: 'You cannot send messages to a user you have blocked' });
        }
        // Upload file to Cloudinary
        const resourceType = getResourceType(req.file.mimetype);
        const uploadResult = await uploadToCloudinary(req.file.buffer, resourceType);
        // Save message to MongoDB with media metadata
        const newMessage = await Message.create({
            sender: senderId,
            receiver: receiverId,
            content: caption,
            media: {
                url: uploadResult.secure_url,
                publicId: uploadResult.public_id,
                resourceType: resourceType,
            },
        });
        // Emit real-time message to receiver if they're online
        const io = req.app.get('io');
        const receiverSocketId = getReceiverSocketId(receiverId);
        const isMuted = sender.mutedUsers.includes(receiverId);

        if (receiverSocketId) {
            io.to(receiverSocketId).emit('new_message', {
                ...newMessage.toJSON(),
                isMuted,
            });
        }


        res.status(201).json({ success: true, data: newMessage });
    } catch (error) {
        res.status(500).json({ message: 'Error sending media message', error: error.message });
    }
};

module.exports = { sendMediaMessage };