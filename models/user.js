const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const passportLocalMongoose = require("passport-local-mongoose");

const userSchema = new Schema({
  email: {
    type: String,
    required: true,
    unique: true // Ensure emails are unique
  },
  college: {
    type: String,
    required: true, 
  },
  contact: {
    type: Number,
    required: true,
  },
  
  // --- VERIFICATION FIELDS ---
  enrollment: {
    type: String,
    required: true,
    unique: true 
  },
  // 1. AI Verification Status
  isIdentityVerified: {
    type: Boolean,
    default: false 
  },
  // 2. Email OTP Verification Status
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  // Temporary storage for the OTP
  emailToken: {
    type: String
  }
});

userSchema.plugin(passportLocalMongoose);
module.exports = mongoose.model("User", userSchema);