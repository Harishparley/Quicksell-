const express = require("express");
const router = express.Router();
const User = require("../models/user");
const Message = require("../models/message");
const { isLoggedIn } = require("../middleware");
const wrapAsync = require("../utils/wrapAsync");

// Helper: Get Active Conversations
async function getConversations(currentUserId) {
    const messages = await Message.find({
        $or: [{ sender: currentUserId }, { receiver: currentUserId }]
    })
    .sort({ timestamp: -1 })
    .populate("sender receiver");

    const userMap = new Map();
    
    messages.forEach(msg => {
        const otherUser = msg.sender._id.equals(currentUserId) ? msg.receiver : msg.sender;
        if (!userMap.has(otherUser._id.toString())) {
            userMap.set(otherUser._id.toString(), otherUser);
        }
    });

    return Array.from(userMap.values());
}

// 1. Dashboard (Inbox Mode)
router.get("/", isLoggedIn, wrapAsync(async (req, res) => {
    const conversationUsers = await getConversations(req.user._id);
    res.render("chat/index.ejs", { 
        allUsers: conversationUsers, 
        selectedUser: null, 
        messages: [] 
    });
}));

// 2. Specific Chat (Handles both Inbox Mode and Seller Mode)
router.get("/:userId", isLoggedIn, wrapAsync(async (req, res) => {
    const { userId } = req.params;
    const { focused } = req.query; // <--- CHECK FOR FLAG
    
    const selectedUser = await User.findById(userId);
    if(!selectedUser) {
        req.flash("error", "User not found");
        return res.redirect("/chat");
    }

    let conversationUsers;

    // LOGIC: If 'focused' is true, hide everyone else.
    if (focused === 'true') {
        conversationUsers = [selectedUser]; 
    } else {
        // Normal mode: Show history
        conversationUsers = await getConversations(req.user._id);
        
        // Ensure selected user is in the list
        const isAlreadyInList = conversationUsers.some(u => u._id.equals(selectedUser._id));
        if (!isAlreadyInList) {
            conversationUsers.unshift(selectedUser);
        }
    }

    // Fetch Messages
    const messages = await Message.find({
        $or: [
            { sender: req.user._id, receiver: userId },
            { sender: userId, receiver: req.user._id }
        ]
    }).sort({ timestamp: 1 }); 

    res.render("chat/index.ejs", { 
        allUsers: conversationUsers, 
        selectedUser, 
        messages 
    });
}));

module.exports = router;