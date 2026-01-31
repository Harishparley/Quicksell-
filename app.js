if (process.env.NODE_ENV !== "production") {
    require("dotenv").config();
}

const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const http = require("http");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const session = require("express-session");
const flash = require("connect-flash");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const { Server } = require("socket.io");

// Local Imports
const User = require("./models/user.js");
const Message = require("./models/message.js");
const { sendOfflineNotification } = require("./utils/email.js");
const ExpressError = require("./utils/ExpressError.js");

// Routes
const productRouter = require("./routes/product.js");
const reviewRouter = require("./routes/review.js");
const userRouter = require("./routes/user.js");
const chatRouter = require("./routes/chat.js");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Database Connection
const dbUrl = process.env.MONGO_URL || "mongodb://127.0.0.1:27017/quick_sell";

mongoose.connect(dbUrl)
    .then(() => console.log("Database Connected"))
    .catch((err) => console.error("Database Connection Error:", err));

// App Configuration
app.engine("ejs", ejsMate);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"));
app.use(express.static(path.join(__dirname, "/public")));

// Session Config
const sessionConfig = {
    secret: process.env.SECRET || "developmentsecret",
    resave: false,
    saveUninitialized: true,
    cookie: {
        httpOnly: true,
        expires: Date.now() + 1000 * 60 * 60 * 24 * 7, // 7 days
        maxAge: 1000 * 60 * 60 * 24 * 7
    }
};

app.use(session(sessionConfig));
app.use(flash());

// Authentication Middleware
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// Global Variables Middleware
app.use((req, res, next) => {
    res.locals.success = req.flash("success");
    res.locals.error = req.flash("error");
    res.locals.currUser = req.user;
    next();
});

// Routes
app.use("/products", productRouter);
app.use("/products/:id/reviews", reviewRouter);
app.use("/chat", chatRouter);
app.use("/", userRouter);

app.get("/", (req, res) => {
    res.redirect("/products");
});

// Socket.io Logic (Real-time Chat)
const onlineUsers = new Set();

io.on("connection", (socket) => {
    
    socket.on("join-chat", (userId) => {
        socket.join(userId);
        onlineUsers.add(userId);
        socket.userId = userId; // Store for disconnect handling
    });

    socket.on("send-message", async (data) => {
        const { senderId, receiverId, content } = data;

        // 1. Persist message
        const newMessage = new Message({
            sender: senderId,
            receiver: receiverId,
            content
        });
        await newMessage.save();

        // 2. Real-time delivery OR Email fallback
        if (onlineUsers.has(receiverId)) {
            io.to(receiverId).emit("receive-message", {
                senderId,
                content,
                timestamp: new Date()
            });
        } else {
            // Asynchronous email notification
            sendOfflineNotification(receiverId, content);
        }
    });

    socket.on("disconnect", () => {
        if (socket.userId) {
            onlineUsers.delete(socket.userId);
        }
    });
});

// Error Handling
// app.all("*", (req, res, next) => {
//     next(new ExpressError(404, "Page Not Found"));
// });

// --- TEMPORARY FIX ROUTE (Use this to fix the duplicate error) ---
app.get("/delete-user", async (req, res) => {
    // Change this email to the one causing the error
    const emailToDelete = "harshparley32323115@gmail.com"; 
    
    await User.deleteOne({ email: emailToDelete });
    res.send(`Deleted user: ${emailToDelete}. Now try Signup again.`);
});

app.use((err, req, res, next) => {
    const { statusCode = 500 } = err;
    if (!err.message) err.message = "Something went wrong";
    res.status(statusCode).render("error.ejs", { err });
});

// Start Server (Only ONE listen call)
const port = process.env.PORT || 8080;
server.listen(port, () => {
    console.log(`Quick Sell App is listening on port ${port}`);
});