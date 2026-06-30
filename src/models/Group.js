const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Group name is required'],
            trim: true,
            minlength: [3, 'Group name must be at least 3 characters'],
        },
        description: {
            type: String,
            trim: true,
            default: '',
        },
        avatar: {
            type: String,
            default: '',
        },
        members: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
            },
        ],
        admins: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
            },
        ],
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
    },
    {
        timestamps: true,
    }
);

// Indexing member array for fast queries (e.g., finding all groups a user belongs to)
groupSchema.index({ members: 1 });

const Group = mongoose.model('Group', groupSchema);

module.exports = Group;
