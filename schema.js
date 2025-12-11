const Joi = require("joi");

module.exports.productSchema = Joi.object({
  product: Joi.object({
    title: Joi.string().required(),
    description: Joi.string().required(),
    location: Joi.string().required(),
    price: Joi.number().required().min(0),
    college: Joi.string().required(),
    // ADDED 'Furniture' here too
    category: Joi.string().valid('Books', 'Electronics', 'Stationery', 'Clothing', 'Furniture', 'Sports', 'Other').required(),
    condition: Joi.string().valid('New', 'Like New', 'Good', 'Fair').required(),
    image: Joi.string().allow("", null),
  }).required(),
});

module.exports.reviewSchema = Joi.object({
  review: Joi.object({
    rating: Joi.number().required().min(1).max(5),
    comment: Joi.string().required(),
  }).required(),
});