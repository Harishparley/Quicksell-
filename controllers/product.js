const Product = require("../models/product.js");
const { cloudinary } = require("../cloudConfig.js");

module.exports.index = async (req, res) => {
  const { search, category } = req.query;
  let query = {};

  if (search && search.trim()) {
      // 1. Clean the search term
      const cleanSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      
      // 2. Create "Smart Search" pattern
      // "Atomic Book" -> matches items containing "Atomic" OR "Book"
      const searchWords = cleanSearch.split(/\s+/); // Split by spaces
      const regexPattern = new RegExp(searchWords.join("|"), "i"); // Create regex: /Atomic|Book/i

      query.$or = [
          { title: { $regex: regexPattern } },        // Match Title
          { description: { $regex: regexPattern } },  // Match Description
          { category: { $regex: regexPattern } },     // Match Category
          { college: { $regex: regexPattern } }       // Match College
      ];
  }

  // Filter by Category (if clicked from footer)
  if (category) {
      query.category = category;
  }

  // Sort by newest first (createdAt: -1)
  const allProducts = await Product.find(query).sort({ createdAt: -1 });
  
  res.render("products/index.ejs", { allProducts });
};

module.exports.renderNewForm = (req, res) => {
  res.render("products/new.ejs");
};

module.exports.showProduct = async (req, res) => {
  let { id } = req.params;
  const product = await Product.findById(id)
    .populate({
      path: "reviews",
      populate: {
        path: "author",
      },
    })
    .populate("owner");
    
  if (!product) {
    req.flash("error", "Product does not exist!");
    return res.redirect("/products");
  }
  res.render("products/show.ejs", { product });
};

module.exports.createProduct = async (req, res, next) => {
  const newProduct = new Product(req.body.product);
  newProduct.owner = req.user._id;
  newProduct.college = req.body.product.college; 

  if (req.files) {
     newProduct.images = req.files.map(f => ({
         url: f.path,
         filename: f.filename
     }));
  }

  await newProduct.save();
  req.flash("success", "New Product Listed!");
  res.redirect("/products");
};

module.exports.renderEditForm = async (req, res) => {
  let { id } = req.params;
  const product = await Product.findById(id);
  if (!product) {
    req.flash("error", "Product not found!");
    return res.redirect("/products");
  }
  res.render("products/edit.ejs", { product });
};

module.exports.updateProduct = async (req, res) => {
  const { id } = req.params;
  const product = await Product.findByIdAndUpdate(id, { ...req.body.product });

  if (req.files && req.files.length > 0) {
    const newImages = req.files.map(f => ({
        url: f.path,
        filename: f.filename
    }));
    product.images.push(...newImages); 
    await product.save();
  }

  req.flash("success", "Product Updated!");
  res.redirect(`/products/${id}`);
};

module.exports.destroyProduct = async (req, res) => {
  let { id } = req.params;
  let deletedProduct = await Product.findByIdAndDelete(id);
  
  if(deletedProduct.images.length > 0) {
      for (let img of deletedProduct.images) {
          await cloudinary.uploader.destroy(img.filename);
      }
  }

  req.flash("success", "Product Deleted!");
  res.redirect("/products");
};