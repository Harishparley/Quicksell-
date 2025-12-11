const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const passportLocalMongoose = require("passport-local-mongoose");

const userSchema = new Schema({
  email: {
    type: String,
    required: true,
  },
  college: {
    type: String,
    required: true, 
  },
  // CHANGED: Removed 'required: true' so old data works fine
  phone: {
    type: Number,
    default: null
  }
});

userSchema.plugin(passportLocalMongoose);

module.exports = mongoose.model("User", userSchema);