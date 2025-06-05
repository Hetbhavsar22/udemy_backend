const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const AdminSchema = new Schema(
  {
    adminId: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
    },
    name: {
      type: String,
    },
    email: {
      type: String,
      unique: true,
      unique: true,
    },
    password: {
      type: String,
    },
    country_code: {
      type: Number,
    },
    mobile_number: {
      type: Number,
    },
    profile_image: {
      type: String,
      default: "/images/default-avatar.jpg",
    },
    active: {
      type: Boolean,
      default: true,
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
      default: null,
    },
    last_login_time: {
      type: Date,
      default: null,
    },
    verification_token: {
      type: String,
    },
  },
  { timestamps: true }
);

const adminModel = mongoose.model("admin", AdminSchema);
module.exports = adminModel;
