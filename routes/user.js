const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync");
const passport = require("passport");
const { saveRedirectUrl, isLoggedIn } = require("../middleware.js");
const userController = require("../controllers/user.js");
const multer = require("multer");

// Setup Multer (Files go to 'uploads/' folder)
const upload = multer({ dest: "uploads/" }); 

router
  .route("/signup")
  .get(userController.renderUserSignupForm)
  .post(
    upload.single("collegeIdImage"), // <--- CRITICAL: Handles the image
    wrapAsync(userController.signup)
  );

router
  .route("/login")
  .get(userController.renderLoginForm)
  .post(
    saveRedirectUrl,
    passport.authenticate("local", {
      failureRedirect: "/login",
      failureFlash: true,
    }),
    userController.login
  );

router.get("/logout", userController.logout);

router.get("/profile", isLoggedIn, wrapAsync(userController.renderProfile));
router.put("/profile/phone", isLoggedIn, wrapAsync(userController.updatePhone));

module.exports = router;