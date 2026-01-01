const express = require("express");
const router = express.Router();
const User = require("../models/user");
const Message = require("../models/message");
const { isLoggedIn } = require("../middleware");
const wrapAsync = require("../utils/wrapAsync");

// Helper: Get Active Conversations with Unread Counts
async function getConversations(currentUserId) {
    const messages = await Message.find({
        $or: [{ sender: currentUserId }, { receiver: currentUserId }]
    })
    .sort({ timestamp: -1 })
    .populate("sender receiver");

    const userMap = new Map();
    
    messages.forEach(msg => {
        // --- FIX: Check if user exists (Prevents 500 Error) ---
        if (!msg.sender || !msg.receiver) {
            return; 
        }
        
        const isSender = msg.sender._id.equals(currentUserId);
        const otherUser = isSender ? msg.receiver : msg.sender;
        const otherUserId = otherUser._id.toString();
        
        if (!userMap.has(otherUserId)) {
            // Convert to Object to append 'unreadCount' property
            const userObj = otherUser.toObject();
            userObj.unreadCount = 0;
            userMap.set(otherUserId, userObj);
        }

        // Calculate Unread Messages:
        // If I am the receiver AND message is NOT read, increment count for that sender
        if (!isSender && !msg.isRead) {
            const userEntry = userMap.get(otherUserId);
            userEntry.unreadCount += 1;
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
    const { focused } = req.query; 
    
    // Check if user exists first
    let selectedUserDoc;
    try {
        selectedUserDoc = await User.findById(userId);
    } catch(e) {
        req.flash("error", "Invalid User ID");
        return res.redirect("/chat");
    }

    if(!selectedUserDoc) {
        req.flash("error", "User not found");
        return res.redirect("/chat");
    }

    // --- MARK AS READ LOGIC ---
    // When opening a chat, mark all messages FROM this user TO me as read
    await Message.updateMany(
        { sender: userId, receiver: req.user._id, isRead: false },
        { isRead: true }
    );

    // Convert doc to object to match getConversations structure
    const selectedUser = selectedUserDoc.toObject();
    selectedUser.unreadCount = 0; // Just marked as read

    let conversationUsers;

    // LOGIC: If 'focused' is true, hide everyone else.
    if (focused === 'true') {
        conversationUsers = [selectedUser]; 
    } else {
        conversationUsers = await getConversations(req.user._id);
        
        // Ensure selected user is in the list
        const isAlreadyInList = conversationUsers.some(u => u._id.toString() === selectedUser._id.toString());
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
    }).sort({ timestamp: 1 })
    .populate("sender receiver");

    res.render("chat/index.ejs", { 
        allUsers: conversationUsers, 
        selectedUser, 
        messages 
    });
}));

module.exports = router;