const User = require("../models/User");
const jwt = require('jsonwebtoken');

const generateToken = (id) => {
    return jwt.sign({id}, process.env.JWT_SECRET, {expiresIn: '30d'});
};

// @desc    Register a new user
// @route   POST /api/auth/register
const register = async (req, res) => {
    try {
        const { username, email, password } = req.body;

        const userExists = await User.findOne({ $or: [{ email }, { username }] });

        if (userExists) {
            return res.status(400).json({ message: 'Username or email already exists' });
        }

        const user = await User.create({
            username,
            email,
            password
        });


        res.status(201).json({
            _id: user._id,
            username: user.username,
            email: user.email,
            avatar: user.avatar,
            token: generateToken(user._id),
        })

    }
    catch (error) {
        res.status(500).json({ message: 'Registration failed', error: error.message });
    }
}


// @desc    Authenticate user & get token (Login)
// @route   POST /api/auth/login
const login = async (req, res) => {
    try {
        const { password, email } = req.body;

        const user = await User.findOne({ email }).select('+password');;

        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const isValidPassword = await user.comparePassword(password);
        if (!isValidPassword) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        user.status = 'Online';
        user.lastActive = Date.now();
        await user.save();

        return res.status(200).json({
            _id: user._id,
            username: user.username,
            email: user.email,
            displayName: user.displayName,
            avatar: user.avatar,
            token: generateToken(user._id),
        });
    }
    catch (error) {
        res.status(500).json({ message: 'Login failed', error: error.message });
    }
};


// @desc    Get current user profile
// @route   GET /api/auth/me
const getMe = async (req, res) => {
    try {
        const user = req.user;
        return res.status(200).json(user);
    }
    catch (error) {
        res.status(500).json({ message: 'Fetching profile failed', error: error.message });
    }
};

module.exports = {
    register,
    login, 
    getMe
}