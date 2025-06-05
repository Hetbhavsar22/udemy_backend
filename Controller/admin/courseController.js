const mongoose = require("mongoose");
const Course = require("../../Model/courseModel");
const Video = require("../../Model/videoModel");
const userModel = require("../../Model/userModel");
const adminModel = require("../../Model/adminModel");
const Enrollment = require("../../Model/enrollmentModel");
const VideoProgress = require("../../Model/VideoProgress");
const Certificate = require("../../Model/CertificateModel");
const Purchase = require("../../Model/coursePurchaseModel");
const upload = require("../../middleware/upload");
const path = require("path");
const fs = require("fs");
const { body, validationResult } = require("express-validator");
const util = require("util");
const jwt = require("jsonwebtoken");
const pdf = require("html-pdf");
const moment = require("moment");
const Settinginfo = require("../../trait/SecretManager");

async function getSecretKey() {
  try {
    if (process.env.APP_ENV === "local") {
      return process.env.SECRET_KEY;
    } else {
      const secret = await Settinginfo.getSecretValue(["COURSE_SECRET_KEY"]);
      return secret.COURSE_SECRET_KEY;
    }
  } catch (error) {
    console.error("Error fetching secret key:", error);
    throw new Error("Could not retrieve SECRET_KEY");
  }
}

const createCourse = async (req, res) => {
  upload(req, res, async (err) => {
    if (err) {
      return res.json({
        status: 400,
        message: err.message,
      });
    }

    try {
      const token = req.headers.authorization.split(" ")[1];
      const SECRET_KEY = await getSecretKey();
      const decodedToken = jwt.verify(token, SECRET_KEY);
      const adminId = decodedToken.id;

      await Promise.all([
        body("cname")
          .notEmpty()
          .withMessage("Course name is required")
          .isLength({ min: 1, max: 255 })
          .withMessage("Course name must be between 1 and 255 characters long")
          .custom((value) => {
            const specialCharRegex = /[^a-zA-Z0-9\s\-\/]/;
            if (specialCharRegex.test(value)) {
              throw new Error(
                "Course name should not contain special characters."
              );
            }
            return true;
          })
          .run(req),
        body("learn")
          .notEmpty()
          .withMessage("What you will Learn field is required")
          .run(req),
        body("totalVideo")
          .notEmpty()
          .withMessage("Total video count is required")
          .isInt({ min: 1 })
          .withMessage("Total video count must be a positive integer")
          .run(req),
        body("author")
          .notEmpty()
          .withMessage("Author name is required")
          .isLength({ min: 1, max: 50 })
          .withMessage("Author name must be between 1 and 50 characters long")
          .custom((value) => {
            const specialCharRegex = /[^a-zA-Z0-9\s]/;
            if (specialCharRegex.test(value)) {
              throw new Error(
                "Author name should not contain special characters."
              );
            }
            return true;
          })
          .run(req),
        body("shortDescription")
          .notEmpty()
          .withMessage("Short description is required")
          .isLength({ min: 1, max: 407 })
          .withMessage("Description must be between 1 and 400 characters long")
          .run(req),
        body("longDescription")
          .notEmpty()
          .withMessage("Long description is required")
          .run(req),
        body("language")
          .notEmpty()
          .withMessage("Language is required")
          .run(req),
        body("price")
          .notEmpty()
          .withMessage("Price is required")
          .isFloat({ min: 0 })
          .withMessage("Price must be a positive number")
          .custom((value) => {
            if (value > 500000) {
              throw new Error("Price must be less than or equal to 5 lakhs.");
            }
            return true;
          })
          .run(req),
        body("dprice")
          .notEmpty()
          .withMessage("Display Price is required")
          .isFloat({ min: 0 })
          .withMessage("Display Price must be a positive number")
          .run(req),
        body("courseGst")
          .notEmpty()
          .withMessage("Course GST is required")
          .isFloat({ min: 0, max: 100 })
          .withMessage("GST must be between 0 and 100.")
          .run(req),
        body("chapters")
          .optional()
          .isArray()
          .withMessage("Chapters must be an array")
          .run(req),
        body("courseType")
          .notEmpty()
          .withMessage("Course type is required")
          .run(req),
        body("percentage")
          .optional()
          .isFloat({ min: 10, max: 100 })
          .withMessage("Percentage should be between 10 and 100.")
          .run(req),
        body("courseExpireTime")
          .notEmpty()
          .withMessage("Course Expire Time is required")
          .isIn(["never", "expire_days"])
          .withMessage("Invalid course expire time value")
          .run(req),
        body("expire_days")
          .optional()
          .isFloat({ min: 1, max: 999 })
          .withMessage("Expire Days should be between 1 and 999.")
          .run(req),
      ]);

      const validationErrorObj = validationResult(req);
      if (!validationErrorObj.isEmpty()) {
        return res.json({
          status: 401,
          message: validationErrorObj.errors[0].msg,
        });
      }

      const {
        cname,
        totalVideo,
        learn,
        hours,
        author,
        shortDescription,
        longDescription,
        language,
        price,
        dprice,
        chapters,
        courseGst,
        courseType,
        courseExpireTime,
        never,
        expire_days,
        percentage,
        startTime,
        endTime,
        elements,
      } = req.body;

      const adjustToUTC = (dateTime) => {
        const date = new Date(dateTime);
        const offset = 5.5 * 60 * 60 * 1000;
        return new Date(date.getTime() - offset);
      };

      const startTimeUTC = startTime ? startTime : null;
      const endTimeUTC = endTime ? endTime : null;

      const courseImage =
        req.files && req.files.courseImage
          ? req.files.courseImage[0].path
          : null;

      const previewVideofile =
        req.files && req.files.previewVideofile
          ? req.files.previewVideofile[0].path
          : null;

      const certificateImage =
        req.files && req.files.certificateImage
          ? req.files.certificateImage[0].path
          : null;

      const parsedElements = JSON.parse(elements);

      const existingCourse = await Course.findOne({ cname });
      if (existingCourse) {
        return res.json({
          status: 401,
          message: "Course with the same details already exists",
        });
      }

      const admin = await adminModel.findById(adminId);
      if (!admin || !mongoose.Types.ObjectId.isValid(adminId)) {
        return res.json({
          status: 401,
          message: "Admin not found",
        });
      }

      const course = new Course({
        adminId,
        cname,
        totalVideo,
        learn,
        courseImage,
        previewVideofile,
        hours,
        author,
        shortDescription,
        longDescription,
        language,
        price,
        dprice,
        chapters: chapters.map((chapter, index) => ({
          number: index + 1,
          name: chapter,
        })),
        courseGst,
        courseType,
        courseExpireTime,
        never: courseExpireTime === "never" ? never : null,
        expire_days: courseExpireTime === "expire_days" ? expire_days : null,
        percentage: courseType === "percentage" ? percentage : null,
        startTime: courseType === "timeIntervals" ? startTimeUTC : null,
        endTime: courseType === "timeIntervals" ? endTimeUTC : null,
        createdBy: admin.name,
        certificateImage,
        certificateDesign: parsedElements,
      });

      if (courseType === "timeIntervals") {
        course.percentage = 80;
      }
      if (courseType === "percentage") {
        course.startTime = null;
        course.endTime = null;
      }
      if (courseType === "allopen") {
        course.percentage = 80;
        course.startTime = null;
        course.endTime = null;
      }

      const savedCourse = await course.save();
      return res.json({
        status: 200,
        data: savedCourse,
      });
    } catch (error) {
      return res.json({
        status: 404,
        message: "Failed to create course",
      });
    }
  });
};

const getAllCourses = async (req, res) => {
  try {
    const {
      search,
      page,
      limit,
      sortBy = "createdAt",
      order = "desc",
      userId,
      cname,
      price,
      dprice,
      courseGst,
      totalVideo,
      hours,
      author,
      language,
      courseType,
      percentage,
      createdBy,
      createdAt,
      active,
      deleted = false,
      pageCount,
    } = req.query;

    const query = {};

    if (active) {
      query.active = active === "true";
    }

    if (search) {
      query.$or = [
        { cname: new RegExp(search, "i") },
        { author: new RegExp(search, "i") },
        { language: new RegExp(search, "i") },
        { courseType: new RegExp(search, "i") },
      ];
    }

    if (cname) {
      query.cname = new RegExp(cname, "i");
    }
    if (price) {
      query.price = price;
    }
    if (dprice) {
      query.dprice = dprice;
    }
    if (courseGst) {
      query.courseGst = courseGst;
    }
    if (totalVideo) {
      query.totalVideo = totalVideo;
    }
    if (hours) {
      query.hours = hours;
    }
    if (author) {
      query.author = new RegExp(author, "i");
    }
    if (language) {
      query.language = new RegExp(language, "i");
    }
    if (courseType) {
      query.courseType = new RegExp(courseType, "i");
    }
    if (percentage) {
      query.percentage = percentage;
    }
    if (createdBy) {
      query.createdBy = createdBy;
    }
    if (createdAt) {
      const createdAtDate = new Date(createdAt);
      query.createdAt = {
        $gte: createdAtDate.setHours(0, 0, 0, 0),
        $lt: createdAtDate.setHours(23, 59, 59, 999),
      };
    }

    const sortOrder = order.toLowerCase() === "asc" ? 1 : -1;

    const totalCourses = await Course.countDocuments(query);

    const courses = await Course.find(query)
      .sort({ [sortBy]: sortOrder })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    if (userId && userId !== "null") {
      const enrollments = await Enrollment.find({ userId });
      const enrolledCourseIds = enrollments.map((enrollment) =>
        enrollment.courseId.toString()
      );

      const coursesWithEnrollmentStatus = courses.map((course) => ({
        _id: course._id,
        cname: course.cname,
        totalVideo: course.totalVideo,
        courseImage: course.courseImage,
        shortDescription: course.shortDescription,
        hours: course.hours,
        language: course.language,
        author: course.author,
        price: course.price,
        dprice: course.dprice,
        isEnrolled: enrolledCourseIds.includes(course._id.toString()),
      }));

      return res.json({
        status: 200,
        courses: coursesWithEnrollmentStatus,
        page: parseInt(page),
        pageCount,
        totalCourses,
      });
    }

    res.json({
      courses,
      totalCourses,
    });
  } catch (error) {
    res.json({
      status: 404,
      message: error.message,
    });
  }
};

const getCourseById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.json({
        status: 400,
        message: "Invalid course ID",
      });
    }

    const course = await Course.findById(id);
    if (!course) {
      return res.json({
        status: 404,
        message: "Course not found",
      });
    }

    let isEnrolled = false;

    const videos = await Video.find({ courseId: id });

    const demoVideos = videos
      .map((video) => ({
        title: video.title,
        demoVideofile: video.demoVideofile,
      }))
      .filter((video) => video.demoVideofile !== null);

    return res.json({
      status: 200,
      data: {
        ...course._doc,
        isEnrolled,
        demoVideos,
      },
    });
  } catch (error) {
    return res.json({
      status: 404,
      message: "Failed to fetch course",
    });
  }
};

const updateCourse = async (req, res) => {
  upload(req, res, async (err) => {
    if (err) {
      return res.json({
        status: 400,
        message: err.message,
      });
    }

    await Promise.all([
      body("cname")
        .notEmpty()
        .withMessage("Course name is required")
        .isLength({ min: 1, max: 255 })
        .withMessage("Course name must be between 1 and 255 characters long")
        .custom((value) => {
          const specialCharRegex = /[^a-zA-Z0-9\s\-\/]/;
          if (specialCharRegex.test(value)) {
            throw new Error(
              "Course name should not contain special characters."
            );
          }
          return true;
        })
        .run(req),
      body("learn")
        .notEmpty()
        .withMessage("What you will Learn field is required")
        .run(req),
      body("totalVideo")
        .notEmpty()
        .withMessage("Total Videos cannot be empty")
        .isInt({ min: 1 })
        .withMessage("Total video count must be a positive integer")
        .run(req),

      body("shortDescription")
        .notEmpty()
        .withMessage("Short description cannot be empty")
        .isLength({ max: 407 })
        .withMessage("Short description cannot exceed 400 characters")
        .run(req),

      body("longDescription")
        .optional()
        .notEmpty()
        .withMessage("Long description cannot be empty")
        .run(req),

      body("language")
        .notEmpty()
        .withMessage("Language cannot be empty")
        .isIn(["English", "Hindi", "Gujarati"])
        .withMessage("Invalid language")
        .run(req),

      body("price")
        .notEmpty()
        .withMessage("Price is required")
        .isFloat({ min: 0 })
        .withMessage("Price must be a positive number")
        .custom((value) => {
          if (value > 500000) {
            throw new Error("Price must be less than or equal to 5 lakhs.");
          }
          return true;
        })
        .run(req),
      body("dprice")
        .notEmpty()
        .withMessage("Display Price is required")
        .isFloat({ min: 0 })
        .withMessage("Display Price must be a positive number")
        .run(req),

      body("courseGst")
        .notEmpty()
        .withMessage("Course GST is required")
        .isFloat({ min: 0, max: 100 })
        .withMessage("GST must be between 0 and 100.")
        .run(req),

      body("courseType")
        .notEmpty()
        .withMessage("Course type is required")
        .run(req),
      body("percentage")
        .optional()
        .isFloat({ min: 10, max: 100 })
        .withMessage("Percentage should be between 10 and 100.")
        .run(req),
      body("courseExpireTime")
        .notEmpty()
        .withMessage("Course Expire Time is required")
        .isIn(["never", "expire_days"])
        .withMessage("Invalid course expire time value")
        .run(req),
      body("expire_days")
        .optional()
        .isFloat({ min: 1, max: 999 })
        .withMessage("Expire Days should be between 1 and 999.")
        .run(req),
    ]);

    const validationErrorObj = validationResult(req);
    if (!validationErrorObj.isEmpty()) {
      return res.json({
        status: 401,
        message: validationErrorObj.errors[0].msg,
      });
    }

    const { courseId } = req.params;
    const {
      cname,
      totalVideo,
      learn,
      hours,
      author,
      shortDescription,
      longDescription,
      language,
      price,
      dprice,
      chapters,
      courseGst,
      courseType,
      courseExpireTime,
      never,
      expire_days,
      percentage,
      startTime,
      endTime,
      elements,
    } = req.body;
    
    const adjustToUTC = (dateTime) => {
      const date = new Date(dateTime);
      const offset = 5.5 * 60 * 60 * 1000;
      return new Date(date.getTime() - offset);
    };

    const startTimeUTC = startTime ? startTime : null;
    const endTimeUTC = endTime ? endTime : null;

    if (!courseId) {
      return res.json({
        status: 400,
        message: "Course ID is required.",
      });
    }

    const courseImage =
      req.files && req.files.courseImage ? req.files.courseImage[0].path : null;

    const previewVideofile =
      req.files && req.files.previewVideofile
        ? req.files.previewVideofile[0].path
        : null;

    const certificateImage =
      req.files && req.files.certificateImage
        ? req.files.certificateImage[0].path
        : null;
        let parsedElements
if(elements){
   parsedElements = JSON.parse(elements);
}


    try {
      const course = await Course.findById(courseId);
      if (!course) {
        return res.json({
          status: 404,
          message: "Course not found",
        });
      }

      const existingCourse = await Course.findOne({
        cname,
        _id: { $ne: courseId },
      });
      if (existingCourse) {
        return res.json({
          status: 401,
          message: "Course with the same details already exists",
        });
      }

      course.cname = cname || course.cname;
      course.totalVideo = totalVideo || course.totalVideo;
      course.learn = learn || course.learn;
      course.courseImage = courseImage || course.courseImage;
      course.previewVideofile = previewVideofile || course.previewVideofile;
      course.hours = hours || course.hours;
      course.author = author || course.author;
      course.shortDescription = shortDescription || course.shortDescription;
      course.longDescription = longDescription || course.longDescription;
      course.language = language || course.language;
      course.price = price || course.price;
      course.dprice = dprice || course.dprice;
      course.certificateImage = certificateImage || course.certificateImage;
      if(elements){
        course.certificateDesign = parsedElements;
      }

      if (chapters) {
        course.chapters = chapters.map((chapter, index) => ({
          number: index + 1,
          name: chapter,
        }));
      }

      course.courseGst = courseGst || course.courseGst;
      course.courseType = courseType || course.courseType;
      if (courseType === "percentage") {
        course.percentage = percentage || course.percentage;
        course.startTime = null;
        course.endTime = null;
      } else if (courseType === "timeIntervals") {
        course.startTime = startTimeUTC || course.startTime;
        course.endTime = endTimeUTC || course.endTime;
        course.percentage = null;
      }

      if (courseType === "timeIntervals") {
        course.percentage = 0;
      }
      if (courseType === "percentage") {
        course.startTime = null;
        course.endTime = null;
      }
      if (courseType === "allopen") {
        course.percentage = 0;
        course.startTime = null;
        course.endTime = null;
      }

      if (courseExpireTime === "never") {
        course.expireTime = "never";
        course.expire_days = null;
      } else if (courseExpireTime === "expire_days") {
        course.expire_days = expire_days;
      }

      const updatedCourse = await course.save();
      return res.json({
        status: 200,
        message: "Course updated successfully",
        data: updatedCourse,
      });
    } catch (error) {
      return res.json({
        status: 404,
        message: "Failed to update course",
      });
    }
  });
};

const unlinkFile = util.promisify(fs.unlink);
const rmdir = util.promisify(fs.rmdir);
const fsPromises = fs.promises;

const deleteCourse = async (req, res) => {
  try {
    const { id } = req.params;
    const course = await Course.findById(id);

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    course.deleted = true;
    course.deletedAt = new Date();

    await course.save();

    res.json({
      status: 200,
      message: "Course deleted successfully (soft delete)",
      course,
    });
  } catch (error) {
    res.json({
      status: 404, 
      message: "Server error" 
    });
  }
};

const courseCheckout = async (req, res) => {
  await Promise.all([
    body("courseId")
      .notEmpty()
      .withMessage("Course ID is required")
      .custom((value) => mongoose.Types.ObjectId.isValid(value))
      .withMessage("Invalid Course ID")
      .run(req),

    body("userId")
      .notEmpty()
      .withMessage("User ID is required")
      .custom((value) => mongoose.Types.ObjectId.isValid(value))
      .withMessage("Invalid User ID")
      .run(req),
  ]);

  const validationErrorObj = validationResult(req);
  if (!validationErrorObj.isEmpty()) {
    return res.status(400).json({
      status: 400,
      message: validationErrorObj.errors[0].msg,
    });
  }

  const { courseId, userId } = req.body;

  try {
    const course = await Course.findById(courseId);
    const user = await userModel.findById(userId);

    if (!course) {
      return res.json({
        status: 404,
        message: "Course not found",
      });
    }

    if (!user) {
      return res.json({
        status: 404,
        message: "User not found",
      });
    }

    if (!course.adminId) {
      return res.json({
        status: 400,
        message: "Course has no adminId assigned",
      });
    }

    const existingEnrollment = await Enrollment.findOne({
      courseId: courseId,
      userId: userId,
    });

    if (existingEnrollment) {
      return res.json({
        status: 400,
        message: "User already enrolled in this course",
      });
    }

    const EnrollCourse = new Enrollment({
      courseId: courseId,
      userId: userId,
      enrolledAt: new Date(),
    });

    await EnrollCourse.save();

    return res.json({
      status: 201,
      message: "Enrollment successful",
      data: EnrollCourse,
    });
  } catch (error) {
    return res.status(404).json({
      status: 404,
      message: "Server error",
      error: error.message,
    });
  }
};

const coursetoggleButton = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) {
      return res.json({
        status: 404,
        message: "Course not found",
      });
    }
    course.active = !course.active;
    await course.save();
    res.json({
      status: 200,
      course,
    });
  } catch (error) {
    res.json({
      status: 404,
      message: "Server error",
    });
  }
};

const getdashboard = async (req, res) => {
  try {
    const currentDate = new Date();
    const past30Days = new Date(currentDate);
    past30Days.setDate(currentDate.getDate() - 30);

    const totalCourses = await Course.countDocuments({ active: true });
    const activeCourses = await Course.countDocuments({ active: true });

    const totalVideos = await Video.countDocuments();
    const activeVideos = await Video.countDocuments({ active: true });

    const totalUsers = await userModel.countDocuments();
    const activeUsers = await userModel.countDocuments({ active: true });
    const verifiedUsers = await userModel.countDocuments({
      otp: null,
      verification_token: null,
    });
    const unverifiedUsers = await userModel.countDocuments({
      $or: [{ otp: { $ne: null } }, { verification_token: { $ne: null } }],
    });

    const totalSales = await Enrollment.countDocuments();
    const oneMonthSales = await Purchase.countDocuments({
      transactionDate: { $gte: past30Days },
    });

    res.status(200).json({
      totalCourses,
      activeCourses,
      totalVideos,
      activeVideos,
      totalUsers,
      verifiedUsers,
      unverifiedUsers,
      activeUsers,
      totalSales,
      oneMonthSales,
    });
  } catch (error) {
    res.status(404).json({
      status: 404, 
      message: "Server error" 
    });
  }
};

const checkCourseCompletion = async (userId, courseId) => {
  try {
    const videoProgressRecords = await VideoProgress.find({ userId, courseId });

    const allVideosCompleted = videoProgressRecords.every(
      (video) => video.progress === 100
    );

    const totalProgress = videoProgressRecords.reduce(
      (acc, video) => acc + video.progress,
      0
    );
    const percentageCompleted = totalProgress / videoProgressRecords.length;

    if (allVideosCompleted) {
      await Enrollment.updateOne(
        { userId, courseId },
        { percentageCompleted, CompletedCourseStatus: true }
      );
    } else {
      const totalProgress = videoProgressRecords.reduce(
        (acc, video) => acc + video.progress,
        0
      );
      const percentageCompleted = totalProgress / videoProgressRecords.length;

      await Enrollment.updateOne({ userId, courseId }, { percentageCompleted });
    }
  } catch (error) {
    console.error("Error checking course completion:", error);
  }
};

const updateVideoProgress = async (userId, videoId, courseId, progress) => {
  try {
    await VideoProgress.findOneAndUpdate(
      { userId, videoId, courseId },
      {
        progress,
        completed: progress >= 100,
        updatedAt: Date.now(),
      },
      { upsert: true, new: true }
    );

    await checkCourseCompletion(userId, courseId);
  } catch (error) {
    console.error("Error updating video progress:", error);
  }
};

const generateCertificate = async (req, res) => {
  try {
    const { userName, courseId, userId } = req.body;

    if (!userName || !courseId || !userId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }

    let { certificateImage, certificateDesign } = course;
    if (!certificateImage || !certificateDesign) {
      return res.status(404).json({ error: "Certificate design not found" });
    }

    certificateImage = certificateImage.replace(/\\/g, "/");

    const currentDate = moment().format("MM/DD/YYYY");
    const certificateNumber = `MGPS/${moment().format("YYYY/MM")}/${String(
      (await Certificate.countDocuments()) + 1
    ).padStart(2, "0")}`;

    const signatureImageUrl1 =
      "https://stgcourseapi.garbhsanskarguru.com/public/hardik_sign.png";
    const signatureImageUrl2 =
      "https://stgcourseapi.garbhsanskarguru.com/public/hardik_sign.png";
    const signatureImageUrl3 =
      "https://stgcourseapi.garbhsanskarguru.com/public/hardik_sign.png";
    const signatureImageUrl4 =
      "https://stgcourseapi.garbhsanskarguru.com/public/hardik_sign.png";

    const html = `
<html>
<head>
  <style>
    body {
      margin: 0;
      padding: 0;
      position: relative;
    }
    .background {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-image: url('https://stgcourseapi.garbhsanskarguru.com/${certificateImage}');
      background-size: cover;
      background-repeat: no-repeat;
      z-index: 1;
      background-position: top;
    }
    .text {
      position: relative;
      z-index: 2;
      color: black;
      font-size: 35px;
      font-weight: bold;
    }
    ${certificateDesign
      .map(
        (el) => `
      .${el.id} {
        left: ${el.position.x}px;
        top: ${40 + el.position.y}px;
      }
    `
      )
      .join("")}
  </style>
</head>
<body>
  <div class="background"></div>
  <div class="text userName"><span style="display: inline-block; vertical-align: middle;">Name:- ${userName}</span></div>
  <div class="text courseName"><span style="display: inline-block; vertical-align: middle;">Course Name:- ${
    course.cname
  }</span></div>
  <div style="display: inline-block; vertical-align: middle; margin-left: 200px;" class="text certificateId">
  <span>${certificateNumber}</span>
</div>
<div style="display: inline-block; vertical-align: middle; margin-left: -500px;" class="text certificateDate">
  <span>${currentDate}</span>
</div>

  <div class="text courseDuration"><span style="display: inline-block; vertical-align: middle; margin-left: 100px;">${course.hours}</span></div>
  <img class="text signature1" style="width: 350px; height: 150px; margin-top: -130px; margin-left: -230px;" src="${signatureImageUrl1}" alt="Signature1" />
  <img class="text signature2" style="width: 350px; height: 150px; margin-top: -130px; margin-left: -230px;" src="${signatureImageUrl2}" alt="Signature2" />
  <img class="text signature3" style="width: 350px; height: 150px; margin-top: -130px; margin-left: -230px;" src="${signatureImageUrl3}" alt="Signature3" />
  <img class="text signature4" style="width: 350px; height: 150px; margin-top: -130px; margin-left: -230px;" src="${signatureImageUrl4}" alt="Signature4" />
</body>
</html>
`;
    const options = {
      width: "1256px",
      height: "740px",
    };

    pdf.create(html, options).toBuffer(async (err, buffer) => {
      if (err) {
        return res.status(404).json({
          status: 404, 
          error: "Error generating PDF" 
        });
      }

      try {
        const newCertificate = new Certificate({
          courseId,
          userId,
          userName,
          courseName: course.cname,
          certificateNumber,
        });

        const savedCertificate = await newCertificate.save();

        res.json({
          message: "Certificate generated successfully!",
          certificateUrl: `data:application/pdf;base64,${buffer.toString(
            "base64"
          )}`,
          pdfBase64: buffer.toString("base64"),
          userName,
          courseName: course.cname,
          date: currentDate,
          certificateNumber,
        });
      } catch (saveError) {
        return res
          .status(404)
          .json({ error: "Error saving certificate to database" });
      }
    });
  } catch (error) {
    return res.status(404).json({
      status: 404, 
      error: "Error generating certificate" 
    });
  }
};

// const getRecommendedCourses = async (req, res) => {
//   try {
//     const { courseId } = req.params;
//     const { userId } = req.params;
//     const purchasedCourse = await Course.findById(courseId);

//     if (!purchasedCourse) {
//       return res.status(404).json({ message: "Course not found" });
//     }

//     const { courseType, author, language } = purchasedCourse;

//     if (!courseType || !author || !language) {
//       return res.status(400).json({
//         message:
//           "Course information incomplete: missing courseType, author, or language",
//       });
//     }

//     const userEnrollment = await Enrollment.findOne({ userId, courseId });
//     const active = userEnrollment ? userEnrollment.active : false; // Set active based on enrollment

//     const userEnrollments = await Enrollment.find({ userId }).select("courseId");
//     const purchasedCourseIds = userEnrollments.map((enrollment) =>
//       enrollment.courseId.toString()
//     );

//     let similarCourses = await Course.find({
//       _id: { $ne: purchasedCourse._id, $nin: purchasedCourseIds },
//       deleted: false,
//       $or: [
//         { courseType: courseType },
//         { author: author },
//         { language: language },
//       ],
//     }).limit(5);

//     if (!similarCourses.length) {
//       similarCourses = await Course.find({
//         _id: { $ne: purchasedCourse._id, $nin: purchasedCourseIds },
//         deleted: false,
//         $or: [{ courseType: courseType }, { author: author }],
//       }).limit(5);

//       if (!similarCourses.length) {
//         similarCourses = await Course.find({
//           _id: { $ne: purchasedCourse._id, $nin: purchasedCourseIds },
//           deleted: false,
//           courseType: courseType,
//         }).limit(5);
//       }
//     }

//     if (!similarCourses.length) {
//       return res.status(404).json({ message: "No similar courses found" });
//     }

//     return res.status(200).json({ similarCourses, active });
//   } catch (error) {
//     return res.status(404).json({
// status: 404, 
// message: "Internal server error" 
// });
//   }
// };

const getRecommendedCourses = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { userId } = req.params;
    const purchasedCourse = await Course.findById(courseId);

    if (!purchasedCourse) {
      return res.status(404).json({ message: "Course not found" });
    }

    const { courseType, author, language } = purchasedCourse;

    if (!courseType || !author || !language) {
      return res.status(400).json({
        message:
          "Course information incomplete: missing courseType, author, or language",
      });
    }

    const userEnrollments = await Enrollment.find({ userId }).select(
      "courseId"
    );
    const purchasedCourseIds = userEnrollments.map((enrollment) =>
      enrollment.courseId.toString()
    );

    let similarCourses = await Course.find({
      _id: { $ne: purchasedCourse._id, $nin: purchasedCourseIds },
      deleted: false,
      $or: [
        { courseType: courseType },
        { author: author },
        { language: language },
      ],
    }).limit(5);

    if (!similarCourses.length) {
      similarCourses = await Course.find({
        _id: { $ne: purchasedCourse._id, $nin: purchasedCourseIds },
        deleted: false,
        $or: [{ courseType: courseType }, { author: author }],
      }).limit(5);

      if (!similarCourses.length) {
        similarCourses = await Course.find({
          _id: { $ne: purchasedCourse._id, $nin: purchasedCourseIds },
          deleted: false,
          courseType: courseType,
        }).limit(5);
      }
    }

    if (!similarCourses.length) {
      return res.status(404).json({ message: "No similar courses found" });
    }

    return res.status(200).json(similarCourses);
  } catch (error) {
    return res.status(404).json({
      status: 404, 
      message: "Internal server error" 
    });
  }
};

const getCourses = async (req, res) => {
  try {
    const { userId, page = 1, limit = 6 } = req.query;

    if (!userId || userId === "null") {
      return res.status(400).json({ message: "User ID is required" });
    }

    // Fetch all purchased course IDs for the given user
    const purchasedCourses = await Purchase.find({ userId }).select("courseId");
    const purchasedCourseIds = purchasedCourses.map((purchase) =>
      purchase.courseId.toString()
    );

    // Fetch active courses that are not purchased
    const query = {
      active: true,
      _id: { $nin: purchasedCourseIds }, // Exclude purchased courses
    };

    // Find courses with pagination
    const availableCourses = await Course.find(query)
      .sort({ createdAt: -1 }) // Sort by newest first
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const totalCourses = await Course.countDocuments(query);

    res.json({
      courses: availableCourses,
      page: parseInt(page),
      totalCourses,
    });
  } catch (error) {
    res.status(404).json({
      status: 404, 
      message: error.message 
    });
  }
};

module.exports = {
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
};
