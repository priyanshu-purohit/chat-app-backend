const express = require('express');
const router = express.Router();
const { sendMessage, getMessages, markAsRead } = require('../controllers/messageController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.post('/send/:id', sendMessage);

router.get('/:id', getMessages);

router.patch('/read/:id', markAsRead);

module.exports = router;