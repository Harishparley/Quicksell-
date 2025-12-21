const User = require("../models/user.js");
const Product = require("../models/product.js");
const { createWorker } = require("tesseract.js");
const fs = require("fs");
const sharp = require("sharp");
const path = require("path");
const nodemailer = require("nodemailer");

// --- 1. CONFIGURE EMAIL TRANSPORTER ---
// IMPORTANT: Replace with your actual App Password!
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'harshparley32323115@gmail.com', // PUT YOUR EMAIL
        pass: 'yrmx unzx kptf rvop'      // PUT YOUR APP PASSWORD
    }
});

module.exports.renderUserSignupForm = (req, res) => {
  res.render("users/signup.ejs");
};

// --- HELPER: SMART NORMALIZE ---
const smartNormalize = (str) => {
  return str.toUpperCase().replace(/1/g, "I").replace(/0/g, "O").replace(/5/g, "S").replace(/8/g, "B").replace(/[^A-Z0-9]/g, "");
};

// --- 2. UPDATED SIGNUP LOGIC (AI + OTP SEND) ---
module.exports.signup = async (req, res, next) => {
  let processedImagePath = "";

  try {
    if (!req.file) {
      req.flash("error", "Please upload your College ID Card.");
      return res.redirect("/signup");
    }

    let { username, email, password, college, contact, enrollment } = req.body;

    // A. PRE-PROCESSING
    const originalPath = req.file.path;
    processedImagePath = path.join("uploads", `processed-${req.file.filename}.png`);
    await sharp(originalPath).resize(1200).grayscale().threshold(140).sharpen().toFile(processedImagePath);

    // B. AI READING
    const worker = await createWorker("eng");
    await worker.setParameters({ tessedit_char_whitelist: "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ" });
    const { data: { text } } = await worker.recognize(processedImagePath);
    await worker.terminate();

    // C. VERIFICATION
    const aiSmart = smartNormalize(text);
    const userSmart = smartNormalize(enrollment);

    if (aiSmart.includes(userSmart)) {
      // SUCCESS: Clean up images
      fs.unlinkSync(originalPath);
      fs.unlinkSync(processedImagePath);

      // --- GENERATE OTP ---
      const otp = Math.floor(100000 + Math.random() * 900000).toString(); 

      // Create User (BUT DO NOT LOGIN YET)
      const newUser = new User({
        email, username, college, contact, enrollment,
        isIdentityVerified: true,  // AI Passed
        isEmailVerified: false,    // OTP Pending
        emailToken: otp            // Save OTP temporarily
      });
      
      const registeredUser = await User.register(newUser, password);

      // --- SEND EMAIL ---
      try {
          await transporter.sendMail({
              from: 'QuickSell Security',
              to: email,
              subject: 'Verify your QuickSell Account',
              html: `
                <div style="font-family: sans-serif; padding: 20px;">
                    <h2>Welcome to QuickSell!</h2>
                    <p>Your verification code is:</p>
                    <h1 style="color: #11998e; letter-spacing: 5px;">${otp}</h1>
                    <p>Enter this code to activate your account.</p>
                </div>
              `
          });
          console.log(`OTP Sent to ${email}`);
      } catch (emailErr) {
          console.error("Email failed:", emailErr);
          req.flash("error", "ID Verified, but Email Failed. Contact Support.");
          return res.redirect("/login");
      }

      // --- REDIRECT TO OTP PAGE ---
      res.render("users/verify-otp.ejs", { email });

    } else {
      // FAIL
      fs.unlinkSync(originalPath);
      if (fs.existsSync(processedImagePath)) fs.unlinkSync(processedImagePath);
      req.flash("error", `Verification Failed. AI could not read "${enrollment}". Please try a clearer photo.`);
      res.redirect("/signup");
    }
  } catch (e) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    if (processedImagePath && fs.existsSync(processedImagePath)) fs.unlinkSync(processedImagePath);
    console.error(e);
    req.flash("error", "Error processing signup.");
    res.redirect("/signup");
  }
};

// --- 3. NEW: VERIFY OTP FUNCTION ---
module.exports.verifyEmail = async (req, res, next) => {
    const { email, otp } = req.body;
    
    try {
        const user = await User.findOne({ email });

        if(!user) {
            req.flash("error", "User not found.");
            return res.redirect("/signup");
        }

        // Check if OTP matches
        if(user.emailToken === otp) {
            // SUCCESS
            user.isEmailVerified = true;
            user.emailToken = null; // Clear OTP
            await user.save();

            // Login the user
            req.login(user, (err) => {
                if (err) return next(err);
                req.flash("success", "Account Verified! Welcome to QuickSell.");
                res.redirect("/products");
            });
        } else {
            // FAIL
            req.flash("error", "Invalid Code. Please try again.");
            res.render("users/verify-otp.ejs", { email });
        }
    } catch(e) {
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
    const userId = req.user._id;
    await Product.deleteMany({ owner: userId });
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