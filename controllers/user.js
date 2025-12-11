const User = require("../models/user.js");
const Product = require("../models/product.js");

module.exports.renderUserSignupForm = (req, res) => {
  res.render("users/signup.ejs");
};

module.exports.signup = async (req, res, next) => {
  try {
    let { username, email, password, college, phone } = req.body;
    // Save phone and college to the new user
    const newUser = new User({ email, username, college, phone });
    const registeredUser = await User.register(newUser, password);
    
    req.login(registeredUser, (err) => {
      if (err) {
        return next(err);
      }
      req.flash("success", "Welcome to Quick Sell!");
      res.redirect("/products");
    });
  } catch (e) {
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
    if (err) {
      return next(err);
    }
    req.flash("success", "You are logged out!");
    res.redirect("/products");
  });
};

// --- PROFILE LOGIC ---
module.exports.renderProfile = async (req, res) => {
  // Fetch the current user data
  const user = await User.findById(req.user._id);
  // Fetch products belonging to this user
  const products = await Product.find({ owner: req.user._id });
  
  res.render("users/profile.ejs", { user, products });
};

module.exports.updatePhone = async (req, res) => {
  const { phone } = req.body;
  const user = await User.findById(req.user._id);
  user.phone = phone;
  await user.save();
  req.flash("success", "Phone number updated!");
  res.redirect("/profile");
};