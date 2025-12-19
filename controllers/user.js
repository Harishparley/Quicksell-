const User = require("../models/user.js");
const Product = require("../models/product.js");
const { createWorker } = require("tesseract.js");
const fs = require("fs");
const sharp = require("sharp");
const path = require("path");

module.exports.renderUserSignupForm = (req, res) => {
  res.render("users/signup.ejs");
};

// --- HELPER: SMART NORMALIZE ---
const smartNormalize = (str) => {
  return str
    .toUpperCase()
    .replace(/1/g, "I")
    .replace(/0/g, "O")
    .replace(/5/g, "S")
    .replace(/8/g, "B")
    .replace(/[^A-Z0-9]/g, "");
};

// --- SIGNUP LOGIC ---
module.exports.signup = async (req, res, next) => {
  let processedImagePath = "";

  try {
    if (!req.file) {
      req.flash("error", "Please upload your College ID Card.");
      return res.redirect("/signup");
    }

    let { username, email, password, college, contact, enrollment } = req.body;

    // 1. PRE-PROCESSING
    const originalPath = req.file.path;
    processedImagePath = path.join(
      "uploads",
      `processed-${req.file.filename}.png`
    );

    await sharp(originalPath)
      .resize(1200)
      .grayscale()
      .threshold(140)
      .sharpen()
      .toFile(processedImagePath);

    // 2. AI READING
    const worker = await createWorker("eng");
    await worker.setParameters({
      tessedit_char_whitelist: "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    });

    const {
      data: { text },
    } = await worker.recognize(processedImagePath);
    await worker.terminate();

    // 3. SMART CLEANING
    const aiSmart = smartNormalize(text);
    const userSmart = smartNormalize(enrollment);

    console.log("------------------------------------------------");
    console.log(`🔎 LOOKING FOR (Smart): ${userSmart}`);
    console.log(`🤖 AI SAW (Smart):      ${aiSmart}`);
    console.log("------------------------------------------------");

    // 4. VERIFICATION
    if (aiSmart.includes(userSmart)) {
      // SUCCESS
      fs.unlinkSync(originalPath);
      fs.unlinkSync(processedImagePath);

      const newUser = new User({
        email,
        username,
        college,
        contact,
        enrollment,
        isVerified: true,
      });
      const registeredUser = await User.register(newUser, password);

      req.login(registeredUser, (err) => {
        if (err) return next(err);
        req.flash("success", "Verification Successful! Welcome.");
        res.redirect("/products");
      });
    } else {
      // FAIL
      fs.unlinkSync(originalPath);
      if (fs.existsSync(processedImagePath)) fs.unlinkSync(processedImagePath);

      req.flash(
        "error",
        `Verification Failed. We could not read "${enrollment}" clearly. Please try again.`
      );
      res.redirect("/signup");
    }
  } catch (e) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    if (processedImagePath && fs.existsSync(processedImagePath))
      fs.unlinkSync(processedImagePath);

    console.error(e);
    req.flash("error", "Error processing ID card.");
    res.redirect("/signup");
  }
};

module.exports.renderLoginForm = (req, res) => {
  res.render("users/login.ejs");
};

module.exports.login = async (req, res) => {
  req.flash("success", "Welcome back!");
  // I added back the redirect logic so users go back to where they were
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

// --- NEW FEATURE: DELETE ACCOUNT ---
module.exports.deleteAccount = async (req, res, next) => {
  try {
    const userId = req.user._id;

    // 1. Delete all listings by this user
    await Product.deleteMany({ owner: userId });

    // 2. Delete the user profile
    await User.findByIdAndDelete(userId);

    // 3. Log them out
    req.logout((err) => {
      if (err) {
        return next(err);
      }
      req.flash("success", "Your account and all listings have been deleted.");
      res.redirect("/products");
    });
  } catch (e) {
    req.flash("error", e.message);
    res.redirect("/profile");
  }
};