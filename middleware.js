const Product = require("./models/product.js");
const Review = require("./models/review.js");
const ExpressError = require("./utils/ExpressError.js");
const { productSchema, reviewSchema } = require("./schema.js");

module.exports.isLoggedIn = (req, res, next) => {
  if (!req.isAuthenticated()) {
    req.session.redirectUrl = req.originalUrl;
    req.flash("error", "You must be logged in to create a product!");
    return res.redirect("/login");
  }
  next();
};

module.exports.saveRedirectUrl = (req, res, next) => {
  if (req.session.redirectUrl) {
    res.locals.redirectUrl = req.session.redirectUrl;
  }
  next();
};

module.exports.isOwner = async (req, res, next) => {
  let { id } = req.params;
  let product = await Product.findById(id);
  if (!product.owner.equals(res.locals.currUser._id)) {
    req.flash("error", "You are not the owner of this product");
    return res.redirect(`/products/${id}`);
  }
  next();
};

// --- FIX: UPDATED SECURITY CHECK ---
module.exports.isVerified = (req, res, next) => {
    // We now check for 'isIdentityVerified' (AI) AND 'isEmailVerified' (OTP)
    // If either is missing/false, we block the action.
    if (req.user && (!req.user.isIdentityVerified || !req.user.isEmailVerified)) {
        req.flash("error", "You must complete verification (ID Card + Email) before selling!");
        return res.redirect("/profile"); 
    }
    next();
};

module.exports.validateProduct = (req, res, next) => {
  // Fix for schema validation
  if(req.body.product && req.user) {
      req.body.product.college = req.user.college;
  }
  let { error } = productSchema.validate(req.body);
  if (error) {
    let errMsg = error.details.map((el) => el.message).join(",");
    throw new ExpressError(400, errMsg);
  } else {
    next();
  }
};

module.exports.validateReview = (req, res, next) => {
  let { error } = reviewSchema.validate(req.body);
  if (error) {
    let errMsg = error.details.map((el) => el.message).join(",");
    throw new ExpressError(400, errMsg);
  } else {
    next();
  }
};

module.exports.isReviewAuthor = async (req, res, next) => {
  let { id, reviewId } = req.params;
  let review = await Review.findById(reviewId);
  if (!review.author.equals(res.locals.currUser._id)) {
    req.flash("error", "You are not the author of this review");
    return res.redirect(`/products/${id}`);
  }
  next();
};