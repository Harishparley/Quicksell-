if (process.env.NODE_ENV != "production") {
  require("dotenv").config();
}

const express = require("express");
const app = express();
const mongoose = require("mongoose");
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const ExpressError = require("./utils/ExpressError.js");
const session = require("express-session");
const flash = require("connect-flash");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const User = require("./models/user.js");

// --- NEW IMPORTS FOR CHAT & EMAIL ---
const http = require("http");
const { Server } = require("socket.io");
const chatRouter = require("./routes/chat.js");
const Message = require("./models/message.js");
const nodemailer = require("nodemailer"); // Import Nodemailer

// --- EMAIL CONFIGURATION ---
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'your-email@gmail.com', // REPLAC WITH YOUR EMAIL
    pass: 'your-app-password'      // REPLAC WITH YOUR APP PASSWORD
  }
});

// Helper: Send Email Notification
async function sendEmailNotification(receiverId, content) {
    try {
        const receiver = await User.findById(receiverId);
        if(!receiver || !receiver.email) return;

        const mailOptions = {
            from: 'QuickSell Notifications <no-reply@quicksell.com>',
            to: receiver.email,
            subject: 'New Message on QuickSell!',
            html: `
                <div style="font-family: sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
                    <h2 style="color: #11998e;">You have a new message!</h2>
                    <p>Someone is interested in your item.</p>
                    <blockquote style="background: #f9f9f9; padding: 10px; border-left: 4px solid #11998e;">
                        "${content}"
                    </blockquote>
                    <a href="http://localhost:8080/chat" style="background: #11998e; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reply Now</a>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        console.log(`Email sent to ${receiver.email}`);
    } catch (err) {
        console.error("Email failed:", err);
    }
}

// Route Imports
const productRouter = require("./routes/product.js");
const reviewRouter = require("./routes/review.js");
const userRouter = require("./routes/user.js");

const MONGO_URL = "mongodb://127.0.0.1:27017/quick_sell";

main()
  .then(() => {
    console.log("Connected to Quick Sell DB");
  })
  .catch((err) => {
    console.log(err);
  });

async function main() {
  await mongoose.connect(MONGO_URL);
}

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"));
app.engine("ejs", ejsMate);
app.use(express.static(path.join(__dirname, "/public")));

const sessionOptions = {
  secret: process.env.SECRET || "thisshouldbeabettersecret",
  resave: false,
  saveUninitialized: true,
  cookie: {
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
  },
};

app.get("/", (req, res) => {
  res.redirect("/products");
});

app.use(session(sessionOptions));
app.use(flash());

app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use((req, res, next) => {
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  res.locals.currUser = req.user;
  next();
});

// --- ROUTE MOUNTING ---
app.use("/products", productRouter);
app.use("/products/:id/reviews", reviewRouter);
app.use("/chat", chatRouter); 
app.use("/", userRouter); 

// --- TEMPORARY FIX ROUTE (Delete after use) ---
app.get("/delete-user", async (req, res) => {
    const { email } = req.query;
    if(email) {
        await User.deleteOne({ email: email });
        res.send(`Deleted user with email: ${email}. You can now signup again.`);
    } else {
        res.send("Please provide an email query parameter.");
    }
});

// --- SOCKET.IO SERVER SETUP ---
const server = http.createServer(app); 
const io = new Server(server);         

// Track Online Users
const onlineUsers = new Set(); 

io.on("connection", (socket) => {
  
  // 1. Join Private Room & Mark Online
  socket.on("join-chat", (userId) => {
    socket.join(userId);
    onlineUsers.add(userId); 
    socket.userId = userId;  
    // console.log(`User ${userId} is Online`);
  });

  // 2. Handle Messages
  socket.on("send-message", async (data) => {
    const { senderId, receiverId, content } = data;

    // A. Save to DB
    const newMessage = new Message({
      sender: senderId,
      receiver: receiverId,
      content: content
    });
    await newMessage.save();

    // B. Check if Receiver is Online
    if (onlineUsers.has(receiverId)) {
        // ONLINE: Send Instant Socket Message
        io.to(receiverId).emit("receive-message", {
            senderId,
            content,
            timestamp: new Date()
        });
    } else {
        // OFFLINE: Send Email Nudge
        console.log(`User ${receiverId} is offline. Sending email...`);
        sendEmailNotification(receiverId, content);
    }
  });

  // 3. Handle Disconnect
  socket.on("disconnect", () => {
    if(socket.userId) {
        onlineUsers.delete(socket.userId); 
    }
  });
});

app.use((err, req, res, next) => {
  let { statusCode = 500, message = "Something went wrong!" } = err;
  res.status(statusCode).render("error.ejs", { message, err });
});

server.listen(8080, () => {
  console.log("Quick Sell App is listening on port 8080");
});