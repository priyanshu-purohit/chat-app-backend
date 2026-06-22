const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI);
        
        console.log(`🍃 MongoDB Connected: ${conn.connection.host}`);
    }
    catch (error) {
        console.log(`❌ MongoDB Connection Error: ${error.message}`);
        process.exit(1);// Exit process with failure code
    }
}

// Monitor connection events for reliability
mongoose.connection.on('disconnected', () => {
    console.warn('⚠️ MongoDB disconnected! Attempting to reconnect...');
});

mongoose.connection.on('error', (err) => {
    console.error(`❌ MongoDB connection error: ${err}`);
});

module.exports = connectDB;