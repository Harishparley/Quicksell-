const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'quick_sell_DEV', // CHANGED: New folder name for the new project
    allowedFormats: ["png", "jpg", "jpeg"], // CHANGED: Use array for formats
  },
});
 
module.exports = {
    cloudinary,
    storage,
}