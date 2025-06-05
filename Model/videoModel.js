const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const videoSchema = new Schema(
  {
    adminId: {
      type: Schema.Types.ObjectId,
      ref: "admin",
    },
    courseId: {
      type: Schema.Types.ObjectId,
      ref: "CourseList",
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    demoVideofile: {
      type: String,
    },
    demo: {
      type: Boolean,
      default: false,
    },
    thumbnail: {
      type: String,
      default: null,
    },
    videofile: {
      type: String,
    },
    videoURL: {
      type: String,
      default: null,
    },
    pdf: {
      type: String,
    },
    ppt: {
      type: String,
    },
    doc: {
      type: String,
    },
    tags: {
      type: [String],
    },
    type: {
      type: String,
      enum: ["video", "document"],
    },
    fileType: {
      type: String,
    },
    active: {
      type: Boolean,
      default: true,
    },
    order: {
      type: Number,
      default: 0,
    },
    chapter: {
      type: String,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    createdBy: {
      type: String,
    },
    updatedBy: {
      type: String,
      ref: "admin",
    },
  },
  { timestamps: true }
);

const Video = mongoose.model("Videos", videoSchema);

module.exports = Video;
