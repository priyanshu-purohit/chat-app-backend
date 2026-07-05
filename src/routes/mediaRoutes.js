const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { sendMediaMessage } = require('../controllers/mediaController');
const upload = require('../middleware/upload');

router.use(protect);

router.post('/send/:id', upload.single('uploaded_file'), sendMediaMessage);

module.exports = router;