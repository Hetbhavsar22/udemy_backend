const multer = require("multer");
const express = require("express");
const {
  login,
  verifyOTP,
  getAllUser,
  getUserById,
  resend_Otp,
} = require("../Controller/user/userLoginController");
const {
  editUser,
  deleteUser,
} = require("../Controller/user/editUserController");
const userModel = require("../Model/userModel");
const { valiDateRequest } = require("../middleware/validationMiddleware");
const { updateVideoProgress } = require("../Controller/admin/videoController");
const {
  getPurchasedCourseDetails,
  getCourseDetails,
} = require("../Controller/user/purchasedCourseController");
const {
  getAllCourses,
  getAllVideos,
} = require("../Controller/user/usercourseController");
const userAuth = require("../middleware/userAuth");
const checkSession = require("../middleware/usercheckSession");
const router = express.Router();

const upload = multer();

router.post("/login", login);
router.post("/verify-otp", verifyOTP);
router.get("/userList", getAllUser);
router.get("/getUserById", getUserById);
router.put("/editUser", editUser);
router.delete("/deleteUser/:id", deleteUser);
router.post("/resend_otp", resend_Otp);

router.patch("/:id/toggle", async (req, res) => {
  try {
    const user = await userModel.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    user.active = !user.active;
    await user.save();
    res.status(200).json(user);
  } catch (error) {
    res.status(404).json({
      status: 404, 
      message: "Server error" 
    });
  }
});

//Razorpay Route
router.post("/purchase-course", valiDateRequest, (req, res) => {
  res.status(200).json({ message: "Course purchased successfully." });
});

// video progress
router.post("/video-progress", updateVideoProgress);
router.get(
  "/purchased-course/:userId/:courseId",
  // authenticate,
  getPurchasedCourseDetails
);

router.get("/getallcourse", getAllCourses);
router.get("/getusercoursedetails/:courseId/:userId", getCourseDetails);
router.get("/getAllVideos", getAllVideos);

module.exports = router;
