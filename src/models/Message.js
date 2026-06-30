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
            required: [true, 'Message content cannot be empty'],
            trim: true,
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
