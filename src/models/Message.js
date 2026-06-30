const mongoose = require('mongoose');

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
