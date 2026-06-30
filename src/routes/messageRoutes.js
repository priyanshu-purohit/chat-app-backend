const express = require('express');
const router = express.Router();
const { 
    sendMessage, 
    getMessages, 
    markAsRead, 
    editMessage, 
    deleteMessage, 
    toggelReaction 
} = require('../controllers/messageController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.post('/send/:id', sendMessage);

router.get('/:id', getMessages);

router.patch('/read/:id', markAsRead);

router.patch('/:id', editMessage);

router.delete('/:id', deleteMessage);

router.post('/:id/react', toggelReaction);

module.exports = router;