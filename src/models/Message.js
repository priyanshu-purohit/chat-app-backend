const mongoose = require('mongoose');

const reactionSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    emoji: {
        type: String, 
        required: true,
    }
}, { _id: false }); // Disable generation of _id for subdocuments to save space

const messageSchema = new mongoose.Schema(
    {
        sender: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'Sender is required'],
        },
        receiver: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: false,
        },
        group: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Group',
            required: false,
        },
        content: {
            type: String,
            trim: true,
            default: '',
        },
        replyTo: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Message',
            default: null,
        },
        isEdited: {
            type: Boolean,
            default: false,
        },
        reactions: [reactionSchema],
        media: {
            url: {
                type: String,
                default: null,
            },
            publicId: {
                type: String,  // Cloudinary public ID (needed for deletion)
                default: null,
            },
            resourceType: {
                type: String,  // 'image', 'video', 'audio', 'raw' (documents)
                enum: ['image', 'video', 'audio', 'raw'],
                default: null,
            },
        },
        status: {
            type: String,
            enum: ['Sent', 'Delivered', 'Read'],
            default: 'Sent',
        },
    },
    {
        timestamps: true, // This adds createdAt and updatedAt (essential for sorting messages chronologically)
    }
);

// Indexing sender and receiver together for fast query performance
messageSchema.index({ sender: 1, receiver: 1, createdAt: -1 });

const Message = mongoose.model('Message', messageSchema);

module.exports = Message;
