const mongoose = require("mongoose");
const initData = require("./data.js");
const Product = require("../models/product.js"); // CHANGED: Listing -> Product
const User = require("../models/user.js"); // CHANGED: Import User to find a valid owner

// CHANGED: Database name updated
const MONGO_URL = "mongodb://127.0.0.1:27017/quick_sell";

main()
  .then(() => {
    console.log("Connected to Quick Sell DB");
  })
  .catch((err) => {
    console.log(err);
  });

async function main() {
  await mongoose.connect(MONGO_URL);
}

const initDB = async () => {
  // 1. Clean the database
  await Product.deleteMany({});
  console.log("Deleted old data");

  // 2. Find a valid user to be the owner
  const owner = await User.findOne({});
  if (!owner) {
      console.log("Error: No users found! Please signup a user on the website first.");
      process.exit(1);
  }

  // 3. Assign that user as the owner for all sample products
  initData.data = initData.data.map((obj) => ({
    ...obj,
    owner: owner._id, 
  }));

  // 4. Insert the data
  await Product.insertMany(initData.data);
  console.log("Data was initialized successfully");
};

initDB().then(() => {
    // Optional: Close connection after seeding
    mongoose.connection.close();
});