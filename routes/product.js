const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync.js");
// IMPORT isVerified
const { isLoggedIn, isOwner, validateProduct, isVerified } = require("../middleware.js");
const productController = require("../controllers/product.js");
const multer = require("multer");
const { storage } = require("../cloudConfig.js");

const upload = multer({ storage });

router
  .route("/")
  .get(wrapAsync(productController.index))
  .post(
    isLoggedIn,
    isVerified, // <--- ADDED SECURITY HERE
    upload.array("product[images]", 5), 
    validateProduct,
    wrapAsync(productController.createProduct)
  );

router.get("/new", isLoggedIn, productController.renderNewForm);

router
  .route("/:id") 
  .get(wrapAsync(productController.showProduct))
  .put(
    isLoggedIn,
    isOwner,
    upload.array("product[images]", 5),
    validateProduct,
    wrapAsync(productController.updateProduct)
  )
  .delete(isLoggedIn, isOwner, wrapAsync(productController.destroyProduct));

router.get(
  "/:id/edit",
  isLoggedIn,
  isOwner,
  wrapAsync(productController.renderEditForm)
);

module.exports = router;