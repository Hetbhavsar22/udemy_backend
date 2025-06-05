const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const coursePurchaseSchema = new Schema(
  {
    courseId: {
      type: Schema.Types.ObjectId,
      ref: "CourseList",
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    transactionDate: {
      type: Date,
      default: Date.now,
    },
    courseExpireTime: {
      type: Date,
    },
    transactionId: {
      type: String,
      unique: true,
      required: true,
    },
    customerName: {
      type: String,
    },
    courseName: {
      type: String,
      ref: "CourseList",
    },
    customerEmail: {
      type: String,
      match: [/.+\@.+\..+/, "Please enter a valid email address"],
    },
    customerMobile: {
      type: Number,
      match: [/^\d{10}$/, "Please enter a valid 10-digit mobile number"],
    },
    customerCity: {
      type: String,
      default: "null",
    },
    customerState: {
      type: String,
    },
    customerCountry: {
      type: String,
      default: "null",
    },
    status: {
      type: String,
      default: "success",
    },
    currency: {
      type: String,
      default: "INR",
    },
    amountWithoutGst: {
      type: Number,
    },
    igst: {
      type: Number,
      default: 0,
    },
    cgst: {
      type: Number,
      default: 0,
    },
    sgst: {
      type: Number,
      default: 0,
    },
    totalGst: {
      type: Number,
      default: function () {
        return this.cgst + this.sgst;
      },
    },
    totalPaidAmount: {
      type: Number,
    },
    paymentMode: {
      type: String,
      enum: [
        "Credit Card",
        "Debit Card",
        "Net Banking",
        "UPI",
        "Wallet",
        "Cash",
        "Admin_Skip",
      ],
    },
    invoiceNumber: {
      type: String,
      unique: true,
    },
    cancelBillNumber: {
      type: String,
      default: null,
    },
    refundAmount: {
      type: Number,
    },
    refundDate: {
      type: Date,
    },
    refundStatus: {
      type: Boolean,
      default: false,
    },
    refundId: {
      type: String,
      default: null,
    },
    refundCount: {
      type: Number,
      default: 0,
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const CoursePurchase = mongoose.model(
  "CoursePurchaseList",
  coursePurchaseSchema
);

module.exports = CoursePurchase;
