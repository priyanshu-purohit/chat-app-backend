
const { rateLimit } = require('express-rate-limit')

// Global API Limiter
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per 15 minutes
    message: {
        message: 'Too many requests from this IP. Please try again after 15 minutes.'
    },
    standardHeaders: true, // Return rate limit info in standard headers
    legacyHeaders: false, // Disable legacy headers
});

// Stricter Limiter for Authentication (Login / Register)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Limit each IP to 10 attempts per 15 minutes
    message: {
        message: 'Too many login or registration attempts. Please try again after 15 minutes.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});


module.exports = { apiLimiter, authLimiter };