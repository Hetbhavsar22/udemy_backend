const express = require("express");
const multer = require("multer");
const auth = require("../middleware/adminAuth");
const router = express.Router();
const upload = multer();
const Video = require("../Model/videoModel");
const Course = require("../Model/courseModel");
const {
  addTag,
  getAllTags,
  getActiveTags,
  editTag,
  deleteTag,
  tagtoggleButton,
} = require("../Controller/admin/tagsController");
const {
  register,
  login,
  verifyOTP,
  verifyToken,
  resend_Otp,
  logout,
  getAdminDetails,
  getAdminById,
  addAdmin,
  deleteAdmin,
  getAllAdmins,
  admintoggleButton,
} = require("../Controller/admin/adminLoginController");
const {
  changePassword,
  updateDetails,
} = require("../Controller/admin/adminChangepassword");
const {
  createCourse,
  getAllCourses,
  getCourseById,
  updateCourse,
  deleteCourse,
  courseCheckout,
  coursetoggleButton,
  getdashboard,
  updateVideoProgress,
  generateCertificate,
  getRecommendedCourses,
  getCourses,
} = require("../Controller/admin/courseController");
const {
  createOrder,
  verifyPayment,
  createSkipOrder,
  getAllCoursePurchases,
  transactiontoggleButton,
  deleteCoursePurchase,
  // initiateRefund,
  coursePurchasetoggleButton,
  getEnrolledCourses,
} = require("../Controller/admin/order_idController");
const {
  createVideo,
  getAllVideos,
  getVideosByCourse,
  updateVideoDetails,
  deleteVideo,
  updateVideoOrder,
  coursechapters,
  videotoggleButton,
} = require("../Controller/admin/videoController");
const {
  initiateRefund,
  getAllRefunds,
} = require("../Controller/admin/refundController");

//Admin Route
router.post("/register", register);
router.post("/login", login);
router.post("/verify-otp", verifyOTP);
router.post("/resend_Otp", resend_Otp);
router.post("/change_password", auth, changePassword);
router.post("/update_details", auth, updateDetails);
router.get("/get_details", auth, getAdminDetails);
router.get("/get_admin", auth, getAdminById);
router.get("/protected-route", verifyToken);
router.get("/logout", logout);
router.post("/add-admin", addAdmin);
router.delete("/delete-admin/:id", deleteAdmin);
router.get("/get-all-admins", getAllAdmins);
router.patch("/:id/admintoggleButton", admintoggleButton);

//Course Route
router.post("/coursedetails", auth, createCourse);
router.get("/courseList", getAllCourses);
router.get("/coursedetails/:id", getCourseById);
router.post("/coursedetails/:courseId", auth, updateCourse);
router.delete("/coursedetails/:id", auth, deleteCourse);
router.post("/courseCheckout", auth, courseCheckout);
router.patch("/:id/coursetoggleButton", coursetoggleButton);
router.get("/dashboard-stats", auth, getdashboard);
router.get("/recommendations/:courseId/:userId", getRecommendedCourses);
router.get("/recommendations", getCourses);
router.post("/update-video-progress", async (req, res) => {
  const { userId, videoId, courseId, progress } = req.body;

  // Validate input
  if (!userId || !videoId || !courseId || progress === undefined) {
    return res.status(400).json({ message: "All fields are required." });
  }

  if (progress < 0) {
    return res
      .status(400)
      .json({ message: "Course Progress cann't be less then 0." });
  }

  if (progress > 100) {
    return res
      .status(400)
      .json({ message: "Course Progress cann't be greater then 100." });
  }

  try {
    // Call the updateVideoProgress function
    await updateVideoProgress(userId, videoId, courseId, progress);
    res.status(200).json({ message: "Course progress updated successfully." });
  } catch (error) {
    res.status(404).json({
      status: 404, 
      message: "Error updating video progress." 
    });
  }
});

//Course Purchase Order Id
router.post("/createOrder", createOrder);
router.post("/verify-payment", verifyPayment);
router.post("/verify-payment-skip", createSkipOrder);
router.get("/purchased-courses-byuser/:userId", getEnrolledCourses);
router.get("/allPurchasedCourse", getAllCoursePurchases);
router.patch("/:id/transactiontoggleButton", transactiontoggleButton);
router.delete("/deletetransaction/:id", auth, deleteCoursePurchase);
// router.post("/refund", initiateRefund);
router.patch("/:id/coursePurchasetoggleButton", coursePurchasetoggleButton);
router.post("/generate-certificate", generateCertificate);

//Video Route
router.post("/:courseId/upload", auth, createVideo);
router.get("/videodetails", auth, getAllVideos);
router.get("/courseWiseVideo/:courseId", auth, getVideosByCourse);
router.post("/editvideodetails/:id", auth, updateVideoDetails);
router.get("/coursechapters/:courseId", auth, coursechapters);
router.delete("/videodetails/:id", auth, deleteVideo);
router.put("/updateVideoOrder", updateVideoOrder);
router.patch("/:id/videotoggleButton", videotoggleButton);

//Tags Route
router.post("/addtag", auth, addTag);
router.get("/getalltags", auth, getAllTags);
router.get("/getActiveTags", auth, getActiveTags);
router.put("/edittags/:id", auth, editTag);
router.delete("/deletetags/:id", auth, deleteTag);
router.patch("/:id/tagtoggleButton", tagtoggleButton);

//Refund Route
router.post("/refund/:transactionId", initiateRefund);
router.get("/allRefund-details", getAllRefunds);

module.exports = router;
