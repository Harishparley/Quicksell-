const nodemailer = require("nodemailer");
const User = require("../models/user");

// Initialize Email Transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS
    }
});

// Send Notification to Offline Users
module.exports.sendOfflineNotification = async (receiverId, content) => {
    try {
        const receiver = await User.findById(receiverId);
        
        // Safety check: User might not exist or have no email
        if (!receiver || !receiver.email) return;

        const mailOptions = {
            from: 'QuickSell Notifications <no-reply@quicksell.com>',
            to: receiver.email,
            subject: 'New Message on QuickSell',
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
                    <h2 style="color: #11998e; margin-bottom: 10px;">You received a new message!</h2>
                    <p style="color: #555;">Someone is interested in your listing on QuickSell.</p>
                    
                    <blockquote style="background: #f9f9f9; padding: 15px; border-left: 4px solid #11998e; margin: 20px 0; font-style: italic;">
                        "${content}"
                    </blockquote>
                    
                    <a href="${process.env.app_url || 'http://localhost:8080'}/chat" 
                       style="background-color: #11998e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                       Reply Now
                    </a>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        console.log(`[Email] Notification sent to ${receiver.email}`);
        
    } catch (err) {
        console.error("[Email Error]", err.message);
    }
};