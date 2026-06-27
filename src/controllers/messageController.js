const { getReceiverSocketId } = require("../config/socket");
const Message = require("../models/Message");
const User = require("../models/User");


// @desc    Send a message to a user
// @route   POST /api/messages/send/:id
const sendMessage = async (req, res) => {
    try {
        const { content } = req.body;
        const receiverId = req.params.id;
        const senderId = req.user._id;

        if (!content || content.trim() === '') {
            return res.status(400).json({ message: 'Message content cannot be empty' });
        }

        const receiver = await User.findById(receiverId);

        if (!receiver) {
            return res.status(404).json({ message: 'Receiver not found' });
        }

        // Save message to MongoDB
        const newMessage = await Message.create({
            sender: senderId,
            receiver: receiverId,
            content: content
        });

        const io = req.app.get('io');

        const receiverSocketId = getReceiverSocketId(receiverId);

        if (receiverSocketId) {
            io.to(receiverSocketId).emit('new_message', newMessage);
        }

        console.log(`✉️ Real-time message emitted from ${senderId} to socket ${receiverSocketId}`);

        return res.status(201).json({
            success: true,
            message: 'Message sent successfully',
            data: newMessage,
        });
    } catch (error) {
        res.status(500).json({ message: 'Error sending message', error: error.message });
    }
}

// @desc    get message from a user
// @route   GET /api/messages/:id
const getMessages = async (req, res) => {
    try {
        const chatPartnerId = req.params.id;
        const currentUserId = req.user._id;
        // Parse query params (limit and cursor)
        const limit = parseInt(req.query.limit, 10) || 20;
        const cursor = req.query.cursor; // This will be a Message ObjectId string
        // Base query: Fetch messages between the two users
        const query = {
            $or: [
                { sender: currentUserId, receiver: chatPartnerId },
                { sender: chatPartnerId, receiver: currentUserId },
            ],
        };
        // If a cursor is provided, fetch messages older than the cursor
        if (cursor) {
            query._id = { $lt: cursor };
        }
        // Fetch limit + 1 messages so we know if there is a next page
        const messages = await Message.find(query)
            .sort({ createdAt: -1 }) // Get newest messages first
            .limit(limit + 1);
        // Check if there is a next page of older messages
        let hasNextPage = false;
        let nextCursor = null;
        if (messages.length > limit) {
            hasNextPage = true;
            // The extra (+1) message is not sent to the client, but its ID becomes the next cursor
            const nextMessage = messages.pop();
            nextCursor = nextMessage._id;
        }
        res.status(200).json({
            messages,
            nextCursor,
            hasNextPage,
        });

    } catch (error) {
        res.status(500).json({ message: 'Error fetching messages', error: error.message });
    }
};


// @desc    Mark messages from a specific sender as read
// @route   PATCH /api/messages/read/:id
const markAsRead = async (req, res) => {
    try {
        const senderId = req.params.id;
        const currentUserId = req.user._id;

        const result = await Message.updateMany({
            sender: senderId,
            receiver: currentUserId,
            status: { $ne: 'Read' }
        }, {
            status: 'Read'
        });


        if (result.modifiedCount > 0) {
            const io = req.app.get('io');
            const senderSocketId = getReceiverSocketId(senderId);

            if (senderSocketId) {
                io.to(senderSocketId).emit("message_read", {
                    readerId: currentUserId
                })
            }
            console.log(`👁️ Read receipt emitted: ${currentUserId} read messages from ${senderId}`);
        }

        res.status(200).json({
            success: true,
            message: 'Messages marked as read',
            modifiedCount: result.modifiedCount
        });

    }
    catch (error) {
        res.status(500).json({ message: 'Error marking messages as read', error: error.message });
    }
}


module.exports = {
    sendMessage,
    getMessages,
    markAsRead 
};