const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync.js");
const { isLoggedIn, isOwner, validateProduct } = require("../middleware.js");
const productController = require("../controllers/product.js");
const multer = require("multer");
const { storage } = require("../cloudConfig.js");

const upload = multer({ storage });

router
  .route("/")
  .get(wrapAsync(productController.index))
  .post(
    isLoggedIn,
    upload.array("product[images]", 5), 
    validateProduct,
    wrapAsync(productController.createProduct)
  );

router.get("/new", isLoggedIn, productController.renderNewForm);

// CHECK THIS BLOCK CAREFULLY IN YOUR CODE
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

// AND THIS ONE
router.get(
  "/:id/edit",
  isLoggedIn,
  isOwner,
  wrapAsync(productController.renderEditForm)
);

module.exports = router;