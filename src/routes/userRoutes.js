const express = require('express');
const router = express.Router();
const {
    toggleBlockUser,
    toggleMuteUser,
    toggleMuteGroup,
    updateFCMToken
} = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.post('/block/:id', toggleBlockUser);
router.post('/mute/:id', toggleMuteUser);
router.post('/mute-group/:id', toggleMuteGroup);
router.post('/fcm-token', updateFCMToken);

module.exports = router;