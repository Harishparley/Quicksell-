const User = require("../models/user.js");
const Product = require("../models/product.js");
const { createWorker } = require("tesseract.js");
const fs = require("fs");
const sharp = require("sharp");
const path = require("path");
const nodemailer = require("nodemailer");

// --- 1. CONFIGURE EMAIL TRANSPORTER ---
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER, // Loaded from .env
    pass: process.env.GMAIL_PASS, // Loaded from .env
  },
});

module.exports.renderUserSignupForm = (req, res) => {
  res.render("users/signup.ejs");
};

// --- HELPER: SMART NORMALIZE ---
// Removes spaces, hyphens, and fixes common OCR mistakes (1->I, 0->O)
const smartNormalize = (str) => {
  if (!str) return "";
  return str
    .toUpperCase()
    .replace(/\s/g, "") // Remove ALL spaces
    .replace(/-/g, "") // Remove hyphens
    .replace(/1/g, "I")
    .replace(/0/g, "O")
    .replace(/5/g, "S")
    .replace(/8/g, "B")
    .replace(/[^A-Z0-9]/g, ""); // Keep only Alphanumeric
};

// --- 2. SIGNUP LOGIC (AI + OTP) ---
module.exports.signup = async (req, res, next) => {
  let processedImagePath = "";

  try {
    if (!req.file) {
      req.flash("error", "Please upload your College ID Card.");
      return res.redirect("/signup");
    }

    let { username, email, password, college, contact, enrollment } = req.body;

    // A. PRE-PROCESSING (Aggressive Cleaning)
    const originalPath = req.file.path;
    processedImagePath = path.join(
      "uploads",
      `processed-${req.file.filename}.png`
    );

    await sharp(originalPath)
      .resize(1500) // Upscale for clarity
      .grayscale() // Remove color noise
      .normalize() // Fix contrast
      .threshold(160) // Force B&W (Removes background patterns)
      .sharpen() // Crisp edges
      .toFile(processedImagePath);

    // B. AI READING
    const worker = await createWorker("eng");
    // Whitelist only valid characters to prevent garbage output
    await worker.setParameters({
      tessedit_char_whitelist: "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-/",
    });

    const {
      data: { text },
    } = await worker.recognize(processedImagePath);
    await worker.terminate();

    // C. MATCHING
    const aiSmart = smartNormalize(text);
    const userSmart = smartNormalize(enrollment);

    // Log for debugging
    console.log("------------------------------------------------");
    console.log(`🔎 LOOKING FOR: ${userSmart}`);
    console.log(`🤖 AI SAW:      ${aiSmart.substring(0, 50)}...`);
    console.log("------------------------------------------------");

    if (aiSmart.includes(userSmart)) {
      // SUCCESS
      fs.unlinkSync(originalPath);
      fs.unlinkSync(processedImagePath);

      // Generate 6-digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();

      // Create User (Pending Verification)
      const newUser = new User({
        email,
        username,
        college,
        contact,
        enrollment,
        isIdentityVerified: true, // AI Passed
        isEmailVerified: false, // Email Pending
        emailToken: otp,
      });

      const registeredUser = await User.register(newUser, password);

      // Send Email
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
        console.log(`OTP Sent to ${email}`);
      } catch (emailErr) {
        console.error("Email failed:", emailErr);
        req.flash(
          "error",
          "ID Verified, but Email Failed. Check email address."
        );
        return res.redirect("/login");
      }

      res.render("users/verify-otp.ejs", { email });
    } else {
      // FAIL
      fs.unlinkSync(originalPath);
      if (fs.existsSync(processedImagePath)) fs.unlinkSync(processedImagePath);

      req.flash(
        "error",
        `Verification Failed. We could not find "${enrollment}" on the card. Try a clearer photo.`
      );
      res.redirect("/signup");
    }
  } catch (e) {
    // Cleanup on crash
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    if (processedImagePath && fs.existsSync(processedImagePath))
      fs.unlinkSync(processedImagePath);
    console.error(e);
    req.flash("error", "Error processing signup.");
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
module.exports.deleteAccount = async (req, res, next) => {
  try {
    await Product.deleteMany({ owner: req.user._id });
    await User.findByIdAndDelete(req.user._id);
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
