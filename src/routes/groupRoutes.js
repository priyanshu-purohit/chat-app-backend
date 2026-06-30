const express = require('express');
const router = express.Router();
const { 
    createGroup, 
    sendGroupMessage, 
    getGroupMessages, 
    addMember, 
    removeMember 
} = require('../controllers/groupController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.post('/', createGroup);

router.post("/:id/send", sendGroupMessage);

router.get("/:id/messages", getGroupMessages);

router.post("/:id/members/add", addMember);

router.post("/:id/member/remove", removeMember);

module.exports = router;