const User = require("../models/user.js");
const Product = require("../models/product.js");
const { createWorker } = require("tesseract.js");
const fs = require("fs");

module.exports.renderUserSignupForm = (req, res) => {
  res.render("users/signup.ejs");
};

// --- AI SIGNUP LOGIC ---
module.exports.signup = async (req, res, next) => {
  try {
    if (!req.file) {
      req.flash("error", "Please upload your College ID Card.");
      return res.redirect("/signup");
    }

    console.log("Image received. Starting AI Verification...");
    let { username, email, password, college, contact, enrollment } = req.body;

    // AI TEXT EXTRACTION
    const worker = await createWorker('eng');
    const { data: { text } } = await worker.recognize(req.file.path);
    await worker.terminate();

    // CLEAN DATA
    const extractedText = text.replace(/\s+/g, '').toUpperCase();
    const userEnrollment = enrollment.replace(/\s+/g, '').toUpperCase();

    console.log(`AI Read: ${extractedText}`);
    console.log(`User Claimed: ${userEnrollment}`);

    // VERIFY
    if (extractedText.includes(userEnrollment)) {
        // Privacy: Delete image
        fs.unlinkSync(req.file.path);

        const newUser = new User({ 
            email, username, college, contact, enrollment, 
            isVerified: true 
        });

        const registeredUser = await User.register(newUser, password);
        
        req.login(registeredUser, (err) => {
            if (err) return next(err);
            req.flash("success", "Verification Successful! Welcome to QuickSell.");
            res.redirect("/products");
        });

    } else {
        fs.unlinkSync(req.file.path);
        req.flash("error", "Verification Failed: We could not read the Enrollment Number on your ID card. Please upload a clearer photo.");
        res.redirect("/signup");
    }

  } catch (e) {
    if(req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    req.flash("error", e.message);
    res.redirect("/signup");
  }
};

module.exports.renderLoginForm = (req, res) => {
  res.render("users/login.ejs");
};

module.exports.login = async (req, res) => {
  req.flash("success", "Welcome back to Quick Sell!");
  let redirectUrl = res.locals.redirectUrl || "/products";
  res.redirect(redirectUrl);
};

module.exports.logout = (req, res, next) => {
  req.logout((err) => {
    if (err) { return next(err); }
    req.flash("success", "You are logged out!");
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
  req.flash("success", "Contact number updated!");
  res.redirect("/profile");
};