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
  // CHANGED: Renamed 'phone' to 'contact' to match your form
  contact: {
    type: Number,
    required: true,
  },
  // --- NEW FIELDS FOR AI VERIFICATION ---
  enrollment: {
    type: String,
    required: true,
    unique: true 
  },
  isVerified: {
    type: Boolean,
    default: false 
  }
});

userSchema.plugin(passportLocalMongoose);
module.exports = mongoose.model("User", userSchema);