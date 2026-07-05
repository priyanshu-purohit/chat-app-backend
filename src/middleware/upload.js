const multer = require('multer');

// Keep file in memory as a Buffer (we'll stream it to Cloudinary, not save to disk)
const storage = multer.memoryStorage();


// File type validation
const fileFilter = (req, file, cb) => {
    const allowedTypes = [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'video/mp4',
        'video/webm',
        'audio/mpeg',
        'audio/ogg',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];

    if (allowedTypes.includes(file.mimetype)){
        cb(null, true); // Accept file
    }
    else {
        cb(new Error('Unsupported file type'), false); // Reject file
    }
};


const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 25 * 1024 * 1024, // 25 MB max file size
    },
});

module.exports = upload;