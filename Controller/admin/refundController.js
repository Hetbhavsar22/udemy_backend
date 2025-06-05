const CoursePurchase = require("../../Model/coursePurchaseModel");
const Enrollment = require("../../Model/enrollmentModel");
const order_IdModel = require("../../Model/order_IdModel");
const Razorpay = require("razorpay");
require("dotenv").config();

async function getRazorpayKeys() {
  try {
    if (process.env.APP_ENV === "local") {
      return {
        razorpayId: process.env.RAZORPAY_ID_KEY,
        razorpaySecret: process.env.RAZORPAY_SECRET_KEY,
      };
    } else {
      const secret = await Settinginfo.getSecretValue([
        "RAZORPAY_TEST_KEY",
        "RAZORPAY_TEST_SECRET",
      ]);
      return {
        razorpayId: secret.COURSE_RAZORPAY_ID_KEY,
        razorpaySecret: secret.COURSE_RAZORPAY_SECRET_KEY,
      };
    }
  } catch (error) {
    throw new Error("Could not retrieve Razorpay keys");
  }
}

// const nodemailer = require("nodemailer");
// const transporter = nodemailer.createTransport({
//   service: "Gmail",
//   auth: {
//     user: process.env.EMAIL_USER,
//     pass: process.env.EMAIL_PASS,
//   },
// });

const initiateRefund = async (req, res) => {
  const { transactionId } = req.params;
  const { refundAmount } = req.body;

  try {
    const { razorpayId, razorpaySecret } = await getRazorpayKeys();

    const razorpayInstance = new Razorpay({
      key_id: razorpayId,
      key_secret: razorpaySecret,
    });

    const purchase = await CoursePurchase.findOne({ transactionId });
    if (!purchase) {
      return res.status(404).json({ message: "Purchase not found" });
    }

    if (purchase.refundStatus) {
      return res
        .status(400)
        .json({ message: "Refund has already been processed" });
    }

    const paymentDetails = await razorpayInstance.payments.fetch(transactionId);

    if (refundAmount * 100 > paymentDetails.amount) {
      return res.status(400).json({
        message: `Refund amount exceeds the captured amount of ₹${
          paymentDetails.amount / 100
        }`,
      });
    }

    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const currentYearMonth = `${year}${month}`;
    const cancelPrefix = `CNC-${currentYearMonth}`;
    const refundCount = await CoursePurchase.countDocuments({
      cancelBillNumber: new RegExp(`^${cancelPrefix}`),
    });
    const cancelBillNumber = `${cancelPrefix}${String(refundCount + 1).padStart(
      2,
      "0"
    )}`;

    if (paymentDetails.status === "authorized") {
      const captureResponse = await razorpayInstance.payments.capture(
        transactionId,
        paymentDetails.amount
      );

      if (captureResponse.status !== "captured") {
        throw new Error(
          "Failed to capture the payment. Refund cannot be initiated."
        );
      }
    }

    const updatedPaymentDetails = await razorpayInstance.payments.fetch(
      transactionId
    );
    if (updatedPaymentDetails.status !== "captured") {
      return res.status(400).json({
        message:
          "Payment capture is still in progress. Please try again shortly.",
      });
    }

    const refund = await razorpayInstance.payments.refund(transactionId, {
      amount: refundAmount,
      notes: { cancelBillNumber },
    });

    if (!refund) {
      throw new Error("Failed to initiate refund with Razorpay.");
    }

    purchase.refundId = refund.id;
    purchase.refundStatus = true;
    purchase.cancelBillNumber = cancelBillNumber;
    purchase.refundAmount = refundAmount;
    purchase.refundDate = new Date();
    purchase.active = false;
    await purchase.save();

    // const emailSubject = purchase.refundStatus
    //   ? "Refund Processed Successfully"
    //   : "Refund Initiation Failed";

    // const emailText = purchase.refundStatus
    //   ? `Dear ${purchase.customerName},\n\nYour refund of ₹${refundAmount} has been processed successfully.\n\nThank you for your patience.\n\nBest regards,\n${process.env.COMPANY_NAME}`
    //   : `Dear Admin,\n\nRefund initiation failed for Transaction ID: ${transactionId}. Please investigate.\n\nThank you,\n${process.env.COMPANY_NAME}`;

    // const mailOptions = {
    //   from: process.env.EMAIL_USER,
    //   to: purchase.refundStatus
    //     ? [purchase.customerEmail, process.env.ADMIN_EMAIL]
    //     : [process.env.ADMIN_EMAIL],
    //   subject: emailSubject,
    //   text: emailText,
    // };

    // transporter.sendMail(mailOptions, (error, info) => {
    //   if (error) {
    //     console.error("Error sending email:", error);
    //   } else {
    //     console.log("Email sent successfully:", info.response);
    //     console.log(`Notification email sent to: ${mailOptions.to.join(", ")}`);
    //   }
    // });

    const enrollmentDeleted = await Enrollment.deleteOne({
      courseId: purchase.courseId,
      userId: purchase.userId,
    });

    if (enrollmentDeleted.deletedCount === 0) {
      console.warn("No enrollment record found to delete.");
    }

    return res.status(200).json({
      success: true,
      message: "Refund initiated successfully",
      refundDetails: refund,
    });
  } catch (error) {

    // const mailOptions = {
    //   from: process.env.EMAIL_USER,
    //   to: process.env.ADMIN_EMAIL,
    //   subject: "Refund Failed",
    //   text: `Dear Admin,\n\nAn error occurred while initiating a refund for Transaction ID: ${transactionId}.\n\nError Details: ${error.message}\n\nPlease investigate.\n\nThank you,\n${process.env.COMPANY_NAME}`,
    // };

    // transporter.sendMail(mailOptions, (err, info) => {
    //   if (err) {
    //     console.error("Error sending failure email:", err);
    //   } else {
    //     console.error("Failure email sent successfully:", info.response);
    //   }
    // });

    return res.status(404).json({
      success: false,
      message: `Error initiating refund: ${error.message}`,
      errorDetails: error,
    });
  }
};

const getAllRefunds = async (req, res) => {
  try {
    const {
      search,
      page,
      limit,
      sortBy = "refundDate",
      order = "desc",
      courseName,
      customerName,
      refundId,
      cancelBillNumber,
      pageCount,
      refundStatusField = "refundStatus",
    } = req.query;

    const query = {
      [refundStatusField]: true,
    };

    const purchases = await CoursePurchase.find({
      refundStatus: true,
    }).populate("courseId userId", "courseName customerName");

    if (search) {
      query.$or = [
        { courseName: new RegExp(search, "i") },
        { customerName: new RegExp(search, "i") },
        { refundId: new RegExp(search, "i") },
        { cancelBillNumber: new RegExp(search, "i") },
      ];
    }

    if (courseName) {
      query.courseName = new RegExp(courseName, "i");
    }
    if (customerName) {
      query.customerName = customerName;
    }
    if (refundId) {
      query.refundId = refundId;
    }
    if (cancelBillNumber) {
      query.cancelBillNumber = cancelBillNumber;
    }

    const sortOrder = order.toLowerCase() === "asc" ? 1 : -1;

    const totalrefunds = await CoursePurchase.countDocuments(query);

    const refunds = await CoursePurchase.find(query)
      .sort({ [sortBy]: sortOrder })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    const responseData = refunds.map((refund) => ({
      transactionId: refund.transactionId,
      refundId: refund.refundId,
      refundDate: refund.updatedAt,
      courseName: refund.courseName,
      customerName: refund.customerName,
      customerEmail: refund.customerEmail,
      mobileNumber: refund.mobileNumber,
      totalPaidAmount: refund.totalPaidAmount,
      cancelBillNumber: refund.cancelBillNumber,
      discountCode: refund.discountCode || null,
    }));

    res.status(200).json({
      success: true,
      message: "All refund details retrieved successfully",
      data: responseData,
      page: parseInt(page),
      pageCount,
      totalrefunds,
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  initiateRefund,
  getAllRefunds,
};
