const { string } = require("joi");
const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const courseSchema = new Schema(
  {
    adminId: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },
    cname: {
      type: String,
      valiDate: {
        validator: function (v) {
          return /^[a-zA-Z0-9\s]+$/.test(v);
        },
        message: (props) =>
          `${props.value} contains special characters, which are not allowed!`,
      },
    },
    totalVideo: {
      type: Number,
    },
    courseImage: {
      type: String,
    },
    previewVideofile: {
      type: String,
    },
    learn: {
      type: String,
    },
    hours: {
      type: String,
      required: true,
      validate: {
        validator: function (v) {
          return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
        },
        message: (props) => `${props.value} is not a valid time format!`,
      },
    },

    author: {
      type: String,
      valiDate: {
        validator: function (v) {
          return /^[a-zA-Z0-9\s]+$/.test(v);
        },
        message: (props) =>
          `${props.value} contains special characters, which are not allowed!`,
      },
    },
    shortDescription: {
      type: String,
    },
    longDescription: {
      type: String,
    },
    language: {
      type: String,
    },
    price: {
      type: String,
    },
    dprice: {
      type: String,
    },
    courseGst: {
      type: Number,
    },
    courseType: {
      type: String,
    },
    courseExpireTime: {
      type: String,
    },
    percentage: {
      type: Number,
    },
    startTime: {
      type: Date,
    },
    endTime: {
      type: Date,
    },
    never: {
      type: String,
    },
    expire_days: {
      type: Number,
    },
    active: {
      type: Boolean,
      default: true,
    },
    chapters: [
      {
        number: {
          type: Number,
        },
        name: {
          type: String,
        },
      },
    ],
    createdAt: {
      type: Date,
      default: Date.now,
    },
    createdBy: {
      type: String,
      ref: "Admin",
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
    deleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    sequence: {
      type: Number,
      default: 0,
    },
    certificateImage: {
      type: String,
    },
    certificateDesign: {
      type: Array,
    },
  },
  { timestamps: true }
);

const Course = mongoose.model("CourseList", courseSchema);

module.exports = Course;
