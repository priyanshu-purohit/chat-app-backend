const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { sendMediaMessage, uploadAvatar } = require('../controllers/mediaController');
const upload = require('../middleware/upload');

router.use(protect);

router.post('/send/:id', upload.single('uploaded_file'), sendMediaMessage);
router.patch('/avatar', upload.single('avatar'), uploadAvatar);

module.exports = router;