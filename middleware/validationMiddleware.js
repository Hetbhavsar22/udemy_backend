const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = require("../Model/userModel");
const Course = require("../Model/courseModel");

const authenticateUser = async (req, res, next) => {
  const token = req.header("Authorization")?.replace("Bearer ", "");

  if (!token) {
    return res.json({
      status: 401,
      error: "User not logged in",
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    const user = await User.findById(req.userId);
    if (!user) {
      return res.json({
        status: 404,
        error: "User does not exist",
      });
    }
    next();
  } catch (err) {
    res.json({
      status: 401,
      error: "Invalid token",
    });
  }
};

const valiDateCourse = async (req, res, next) => {
  const { courseId } = req.body;

  if (!mongoose.Types.ObjectId.isValid(courseId)) {
    return res.json({
      status: 400,
      error: "Invalid course ID format",
    });
  }

  try {
    const course = await Course.findById(courseId);
    if (!course) {
      return res.json({
        status: 400,
        error: "Invalid course ID",
      });
    }
    next();
  } catch (err) {
    res.json({
      status: 404,
      error: "Server error",
    });
  }
};

const valiDateRequest = async (req, res, next) => {
  await authenticateUser(req, res, async () => {
    await valiDateCourse(req, res, next);
  });
};

module.exports = {
  valiDateRequest,
};
