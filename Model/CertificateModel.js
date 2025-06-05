const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const certificateSchema = new Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Course",
    required: true,
  },
  courseName: {
    type: String,
    required: true,
  },
  userName: {
    type: String,
    required: true,
  },
  certificateNumber: {
    type: String,
    required: true,
    unique: true,
  },
  dateIssued: {
    type: Date,
    default: Date.now,
  },
});

const Certificate = mongoose.model("Certificate", certificateSchema);

module.exports = Certificate;
