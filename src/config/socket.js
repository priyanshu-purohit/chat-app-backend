const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const userSocketMap = new Map();

const initSocket = (server) => {
    // Create a new Socket.io server instance linked to our HTTP server
    const io = new Server(server, {
        cors: {
            origin: '*',// Allows connections from any origin (very helpful for local testing)
            methods: ['GET', 'POST'],
        },
    });

    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token || socket.handshake.query.token;

            if (!token) {
                return next(new Error('Authentication error: No token provided'));
            }

            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            const user = await User.findById(decoded.id);

            if (!user) {
                return next(new Error('Authentication error: User not found'));
            }

            socket.user = user;

            next();
        }
        catch (error) {
            console.error('Socket authentication failed:', error.message);
            return next(new Error('Authentication error: Invalid token'));
        }
    })

    // Listen for client connection events
    io.on('connection', async (socket) => {
        const userId = socket.user._id.toString();
        console.log(`🔌 User connected: ${socket.user.username} (Socket ID: ${socket.id})`);

        try {
            await User.findByIdAndUpdate(userId, {
                status: 'Online',
                lastActive: Date.now()
            });

            userSocketMap.set(userId, socket.id);

            socket.broadcast.emit('user_status_change', {
                userId,
                status: 'Online',
            });
        }
        catch (error) {
            console.error(`Error updating online status for ${userId}:`, err.message);
        }



        socket.on('disconnect', async () => {
            console.log(`🔌 User disconnected (Socket ID: ${socket.id})`);
            
            userSocketMap.delete(userId);

            try {
                const now = Date.now();

                await User.findByIdAndUpdate(userId, {
                    status: 'Offline',
                    lastActive: now
                });


                socket.broadcast.emit('user_status_change', {
                    userId,
                    status: 'Offline',
                    lastActive: now,
                });
            }
            catch (error) {
                console.error(`Error updating online status for ${userId}:`, err.message);
            }
        });
    });

    return io;
};


//Helper function to lookup socket ID of a specific user
const getReceiverSocketId = (userId) => {
    return userSocketMap.get(userId);
};

module.exports = { initSocket, getReceiverSocketId };