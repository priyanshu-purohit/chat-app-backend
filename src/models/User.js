const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
    {
        username: {
            type: String,
            required: [true, 'Username is required'],
            unique: true,
            trim: true,
            minlength: [3, 'Username must be at least 3 characters'],
            lowercase: true,
        },
        email: {
            type: String,
            required: [true, 'Email is required'],
            unique: true,
            trim: true,
            lowercase: true,
            match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
        },
        password: {
            type: String,
            required: [true, 'Password is required'],
            minlength: [6, 'Password must be at least 6 characters'],
            select: false, // Prevents password from being returned in queries by default
        },  
        avatar: {
            type: String,
            default: ``,
        },
        blockedUsers: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User'
            }
        ],
        mutedUsers: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User'
            }
        ],
        mutedGroups: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Group'
            }
        ],
        status: {
            type: String,
            default: 'Offline',
            enum: ['Online', 'Offline', 'Away'],
        },
        lastActive: {
            type: Date,
            default: Date.now()
        },
    }, { timestamps: true }
);


// Middleware to hash password before saving to the database
userSchema.pre('save', async function () {
    // Only hash the password if it has been modified (or is new)
    if (!this.isModified('password')) return;

    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

// Instance method to compare entered password with hashed password
userSchema.methods.comparePassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);    
}


const User = mongoose.model('User', userSchema);

module.exports = User;

