const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const Review = require("./review.js");

const productSchema = new Schema({
  title: {
    type: String,
    required: true,
  },
  description: String,
  images: [
    {
      url: String,
      filename: String,
    },
  ],
  price: {
    type: Number,
    required: true,
  },
  college: {
    type: String,
    required: true,
  },
  location: {
    type: String,
    required: true,
  },
  category: {
    type: String,
    // ADDED "Furniture" to this list
    enum: ["Books", "Electronics", "Stationery", "Clothing", "Furniture", "Sports", "Other"], 
    required: true,
  },
  condition: {
    type: String,
    enum: ["New", "Like New", "Good", "Fair"],
    required: true,
  },
  status: {
    type: String,
    enum: ["Available", "Sold"],
    default: "Available",
  },
  reviews: [
    {
      type: Schema.Types.ObjectId,
      ref: "Review",
    },
  ],
  owner: {
    type: Schema.Types.ObjectId,
    ref: "User",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

productSchema.post("findOneAndDelete", async (product) => {
  if (product) {
    await Review.deleteMany({ _id: { $in: product.reviews } });
  }
});

const Product = mongoose.model("Product", productSchema);
module.exports = Product;