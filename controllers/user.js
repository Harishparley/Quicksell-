const User = require("../models/user.js");
const Product = require("../models/product.js");
const Message = require("../models/message.js"); // Added for cleanup
const { createWorker } = require("tesseract.js");
const fs = require("fs");
const sharp = require("sharp");
const path = require("path");
const nodemailer = require("nodemailer");

// --- 1. CONFIGURE EMAIL TRANSPORTER (SECURE) ---
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER, // Uses .env for security
    pass: process.env.GMAIL_PASS, // Uses .env for security
  },
});

module.exports.renderUserSignupForm = (req, res) => {
  res.render("users/signup.ejs");
};

// --- HELPER: SMART NORMALIZE & CLEANING ---
// Fixes common OCR mistakes (homoglyphs)
const smartNormalize = (str) => {
  if (!str) return "";
  return str
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "") // Remove non-alphanumeric chars
    .replace(/1/g, "I") // Map 1 to I (common mixup)
    .replace(/0/g, "O") // Map 0 to O
    .replace(/5/g, "S") // Map 5 to S
    .replace(/8/g, "B") // Map 8 to B
    .replace(/2/g, "Z"); // Map 2 to Z (sometimes happens)
};

// --- 2. SIGNUP LOGIC (Advanced AI + OTP) ---
module.exports.signup = async (req, res, next) => {
  let processedImagePath = "";

  try {
    if (!req.file) {
      req.flash("error", "Please upload your College ID Card.");
      return res.redirect("/signup");
    }

    let { username, email, password, college, contact, enrollment } = req.body;

    // A. INTELLIGENT IMAGE PRE-PROCESSING
    const originalPath = req.file.path;
    processedImagePath = path.join(
      "uploads",
      `processed-${req.file.filename}.png`
    );

    await sharp(originalPath)
      .rotate() // 1. Auto-orient image (Fixes phone rotation issues)
      .resize(1200) // 2. High resolution but not huge
      .grayscale() // 3. Remove color distractions
      .linear(1.5, 0) // 4. Boost Contrast (Make darks darker, lights lighter)
      .sharpen({ sigma: 2 }) // 5. Sharpen text edges
      .toFile(processedImagePath);

    // B. AI READING ENGINE
    const worker = await createWorker("eng");

    // Configure Tesseract for single block text (PSM 6)
    await worker.setParameters({
      tessedit_char_whitelist: "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-/",
      tessedit_pageseg_mode: "6",
    });

    const {
      data: { text },
    } = await worker.recognize(processedImagePath);
    await worker.terminate();

    // C. MATCHING ALGORITHM
    const aiSmart = smartNormalize(text);
    const userSmart = smartNormalize(enrollment);

    // Debugging Logs
    console.log("------------------------------------------------");
    console.log(`🔎 TARGET (Input):  ${userSmart}`);
    console.log(`🤖 AI SAW (Clean):  ${aiSmart.substring(0, 50)}...`);
    console.log("------------------------------------------------");

    // D. CHECK FOR SUBSTRING MATCH
    if (aiSmart.includes(userSmart)) {
      // --- MATCH SUCCESS ---
      fs.unlinkSync(originalPath);
      fs.unlinkSync(processedImagePath);

      // Generate OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();

      const newUser = new User({
        email,
        username,
        college,
        contact,
        enrollment,
        isIdentityVerified: true,
        isEmailVerified: false,
        emailToken: otp,
      });

      const registeredUser = await User.register(newUser, password);

      // Send OTP Email
      try {
        await transporter.sendMail({
          from: "QuickSell Security",
          to: email,
          subject: "Verify your QuickSell Account",
          html: `
                <div style="font-family: sans-serif; padding: 20px;">
                    <h2>Welcome to QuickSell!</h2>
                    <p>Your verification code is:</p>
                    <h1 style="color: #11998e; letter-spacing: 5px;">${otp}</h1>
                    <p>Enter this code to activate your account.</p>
                </div>
              `,
        });
      } catch (emailErr) {
        console.error("Email failed:", emailErr);
        // Allow login even if email fails, but warn user
        req.flash(
          "error",
          "ID Verified, but Email Failed to send. Please try login."
        );
        return res.redirect("/login");
      }

      res.render("users/verify-otp.ejs", { email });
    } else {
      // --- MATCH FAILED ---
      fs.unlinkSync(originalPath);
      if (fs.existsSync(processedImagePath)) fs.unlinkSync(processedImagePath);

      req.flash(
        "error",
        `Verification Failed. The AI read "${text.substring(
          0,
          15
        )}..." but could not find "${enrollment}". Ensure the image is right-side up and clear.`
      );
      res.redirect("/signup");
    }
  } catch (e) {
    // Cleanup on error
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    if (processedImagePath && fs.existsSync(processedImagePath))
      fs.unlinkSync(processedImagePath);

    console.error(e);
    req.flash("error", "System Error during verification. Please try again.");
    res.redirect("/signup");
  }
};

// --- 3. VERIFY OTP ---
module.exports.verifyEmail = async (req, res, next) => {
  const { email, otp } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) {
      req.flash("error", "User not found.");
      return res.redirect("/signup");
    }
    if (user.emailToken === otp) {
      user.isEmailVerified = true;
      user.emailToken = null;
      await user.save();
      req.login(user, (err) => {
        if (err) return next(err);
        req.flash("success", "Account Verified! Welcome to QuickSell.");
        res.redirect("/products");
      });
    } else {
      req.flash("error", "Invalid Code. Please try again.");
      res.render("users/verify-otp.ejs", { email });
    }
  } catch (e) {
    req.flash("error", "Verification Error.");
    res.redirect("/login");
  }
};

module.exports.renderLoginForm = (req, res) => {
  res.render("users/login.ejs");
};
module.exports.login = async (req, res) => {
  req.flash("success", "Welcome back!");
  let redirectUrl = res.locals.redirectUrl || "/products";
  res.redirect(redirectUrl);
};
module.exports.logout = (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.flash("success", "Logged out!");
    res.redirect("/products");
  });
};
module.exports.renderProfile = async (req, res) => {
  const user = await User.findById(req.user._id);
  const products = await Product.find({ owner: req.user._id });
  res.render("users/profile.ejs", { user, products });
};
module.exports.updatePhone = async (req, res) => {
  const { contact } = req.body;
  const user = await User.findById(req.user._id);
  user.contact = contact;
  await user.save();
  req.flash("success", "Updated!");
  res.redirect("/profile");
};

// --- 4. DELETE ACCOUNT (Fixed to remove Messages) ---
module.exports.deleteAccount = async (req, res, next) => {
  try {
    const userId = req.user._id;

    // 1. Delete Products
    await Product.deleteMany({ owner: userId });

    // 2. Delete Messages (Prevent 500 Errors in Chat)
    await Message.deleteMany({
      $or: [{ sender: userId }, { receiver: userId }],
    });

    // 3. Delete User
    await User.findByIdAndDelete(userId);

    req.logout((err) => {
      if (err) return next(err);
      req.flash("success", "Account deleted.");
      res.redirect("/products");
    });
  } catch (e) {
    req.flash("error", e.message);
    res.redirect("/profile");
  }
};
