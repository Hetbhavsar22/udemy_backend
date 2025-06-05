const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const UserSchema = new Schema(
  {
    name: {
      type: String,
    },

    email: {
      type: String,
    },

    countryCode: {
      type: Number,
    },

    city: {
      type: String,
    },

    phoneNumber: {
      type: Number,
    },

    otp: {
      type: String,
    },

    otp_expire_time: {
      type: Date,
      default: null,
    },

    last_Browser_finger_print: {
      type: String,
    },

    login_expire_time: {
      type: Number,
      default: null,
    },

    verification_token: {
      type: String,
    },

    isVerified: {
      type: Boolean,
      default: false,
    },

    active: {
      type: Boolean,
      default: true,
    },

    createdAt: {
      type: Date,
      default: Date.now,
    },
    sequence: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

const userModel = mongoose.model("User", UserSchema);
module.exports = userModel;
