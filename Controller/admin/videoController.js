const upload = require("../../middleware/upload");
const Video = require("../../Model/videoModel");
const Course = require("../../Model/courseModel");
const adminModel = require("../../Model/adminModel");
const Enrollment = require("../../Model/enrollmentModel");
const path = require("path");
const fs = require("fs");
const { body, validationResult } = require("express-validator");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const VideoProgress = require("../../Model/VideoProgress");
const util = require("util");
const unlinkFile = util.promisify(fs.unlink);
const { exec } = require("child_process");

const encodeUrl = (url) => {
  return Buffer.from(url).toString("base64");
};
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
    throw new Error("Could not retrieve SECRET_KEY");
  }
}

const createVideo = (req, res) => {
  upload(req, res, async (err) => {
    if (err) {
      return res.status(400).json({
        status: 400,
        message: err.message,
      });
    }

    try {
      await Promise.all([
        body("title")
          .notEmpty()
          .withMessage("Title is required")
          .isLength({ min: 1, max: 50 })
          .withMessage("Video title must be between 1 and 50 characters long")
          .run(req),
        body("description")
          .notEmpty()
          .withMessage("Description is required")
          .isLength({ min: 1, max: 500 })
          .withMessage("Description must be between 1 and 500 characters long")
          .run(req),
        body("type")
          .notEmpty()
          .withMessage("Type is required")
          .isIn(["video", "document"])
          .withMessage("Invalid type")
          .run(req),
        body("courseId")
          .notEmpty()
          .withMessage("Course ID is required")
          .run(req),
        body("chapter").notEmpty().withMessage("Chapter is required").run(req),
      ]);

      const validationErrorObj = validationResult(req);
      if (!validationErrorObj.isEmpty()) {
        return res.status(401).json({
          status: 401,
          message: validationErrorObj.errors[0].msg,
        });
      }

      const {
        title,
        description,
        tags,
        type,
        courseId,
        chapter,
        videoURL,
        fileType,
      } = req.body;
      const demo = req.body.demo === "true" || req.body.demo === true;
      const videoFilePath =
        req.files && req.files.videofile ? req.files.videofile[0].path : null;
      const encodedVideoURL = videoURL ? encodeUrl(videoURL) : null;

      const course = await Course.findById(courseId);
      if (!course) {
        return res.status(404).json({
          status: 404,
          message: "Course not found",
        });
      }

      const token = req.headers.authorization.split(" ")[1];
      const SECRET_KEY = await getSecretKey();
      const decodedToken = jwt.verify(token, SECRET_KEY);
      const adminId = decodedToken.id;

      const admin = await adminModel.findById(adminId);
      if (!admin || !mongoose.Types.ObjectId.isValid(adminId)) {
        return res.status(401).json({
          status: 401,
          message: "Admin not found",
        });
      }

      const totalVideos = await Video.countDocuments({ courseId });
      const newOrder = -(totalVideos + 1);

      const newMedia = {
        createdBy: admin.name,
        courseId,
        title,
        description,
        tags,
        type,
        active: true,
        order: newOrder,
        chapter,
        videoURL: encodedVideoURL,
        fileType,
        demo,
        demoVideofile: demo ? videoFilePath : null,
        videofile: !demo ? videoFilePath : null,
      };

      if (type === "document") {
        newMedia.pdf = req.files["pdf"] ? req.files["pdf"][0].path : undefined;
        newMedia.ppt = req.files["ppt"] ? req.files["ppt"][0].path : undefined;
        newMedia.doc = req.files["doc"] ? req.files["doc"][0].path : undefined;
      }

      if (type === "video" && demo !== "true" && videoFilePath) {
        newMedia.thumbnail = req.files["thumbnail"]
          ? req.files["thumbnail"][0].path
          : undefined;

        const videoFilePath =
          req.files && req.files.videofile ? req.files.videofile[0].path : null;
        const videoFileName = path.basename(
          videoFilePath,
          path.extname(videoFilePath)
        );
        const outputDir = path.join(
          __dirname,
          "../../public/videos",
          courseId,
          chapter,
          videoFileName
        );

        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }

        const manifestPath = path.join(outputDir, `${videoFileName}.mpd`);

        await new Promise((resolve, reject) => {
          exec(
            `MP4Box -dash 20000 -frag 20000 -rap -profile live -out "${manifestPath}" "${videoFilePath}"`,
            (error, stdout, stderr) => {
              if (error) {
                return reject(`Error generating DASH manifest: ${stderr}`);
              }
              resolve();
            }
          );
        });

        const manifestUrl = `${process.env.BASE_URL}/public/videos/${courseId}/${chapter}/${videoFileName}/${videoFileName}.mpd`;
        newMedia.videofile = manifestUrl;
      }

      const newVideo = new Video(newMedia);
      await newVideo.save();

      return res.json({
        status: 200,
        message: "Media uploaded successfully",
        video: newVideo,
      });
    } catch (error) {
      return res.status(404).json({
        status: 404,
        message: "Failed to create video",
      });
    }
  });
};

const getAllVideos = async (req, res) => {
  try {
    const {
      search,
      page,
      limit,
      sortBy = "order",
      order = "asc",
      courseId,
      author,
      active,
    } = req.query;

    const query = {};

    if (active) {
      query.active = active === "true";
    }

    let courseIds = [];

    if (search) {
      const regex = new RegExp(search, "i");

      query["$or"] = [{ title: regex }];

      const courses = await Course.find({ cname: regex }, "_id");

      if (courses.length) {
        courseIds = courses.map((course) => course._id);
        query["$or"].push({ courseId: { $in: courseIds } });
      }
      if (author) {
        query.author = new RegExp(author, "i");
      }
      if (courseId) {
        query.courseId = courseId;
      }
    }

    const sortOrder = order.toLowerCase() === "asc" ? 1 : -1;

    const totalVideo = await Video.countDocuments(query);

    const videos = await Video.find(query)
      .sort({ courseId: 1, [sortBy]: sortOrder })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate("courseId", "cname")
      .populate("adminId", "name");

    res.json({
      status: 200,
      videos,
      totalVideo,
    });
  } catch (error) {
    res.json({
      status: 404,
      error: "Failed to fetch videos",
    });
  }
};

const getVideosByCourse = async (req, res) => {
  const { courseId } = req.params;
  const {
    search,
    page,
    limit,
    sortBy = "order",
    order = "asc",
    active,
  } = req.query;

  if (!courseId) {
    return res.status(400).json({
      status: 400,
      message: "courseId is required",
    });
  }

  try {
    const query = { courseId };

    if (active === "true") {
      query.active = true;
    } else if (active === "false") {
      query.active = false;
    }

    if (search) {
      const regex = new RegExp(search, "i");
      query["$or"] = [{ title: regex }];

      const courses = await Course.find({ cname: regex }, "_id");
      if (courses.length) {
        const courseIds = courses.map((course) => course._id);
        query["$or"].push({ courseId: { $in: courseIds } });
      }
    }

    const sortOrder = order.toLowerCase() === "asc" ? 1 : -1;

    const totalVideo = await Video.countDocuments(query);

    const videos = await Video.find(query)
      .sort({ courseId: 1, [sortBy]: sortOrder })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate("courseId", "cname")
      .populate("adminId", "name");

    res.json({
      status: 200,
      videos,
      totalVideo,
    });
  } catch (error) {
    res.json({
      status: 404,
      error: "Failed to fetch videos",
    });
  }
};

const updateVideoDetails = (req, res) => {
  upload(req, res, async (err) => {
    if (err) {
      return res.status(400).json({
        status: 400,
        message: err.message,
      });
    }

    await Promise.all([
      body("title")
        .notEmpty()
        .withMessage("Title should be a non-empty string")
        .isLength({ min: 1, max: 50 })
        .withMessage("Video title must be between 1 and 50 characters long")
        .run(req),
      body("description")
        .notEmpty()
        .withMessage("Description should be a non-empty string")
        .isLength({ min: 1, max: 500 })
        .withMessage("Description must be between 1 and 500 characters long")
        .run(req),
      body("type")
        .notEmpty()
        .withMessage("Type is required")
        .isIn(["video", "document"])
        .withMessage("Invalid type")
        .run(req),
      body("chapter").notEmpty().withMessage("Chapter is required").run(req),
    ]);

    const validationErrors = validationResult(req);
    if (!validationErrors.isEmpty()) {
      return res.status(400).json({
        status: 400,
        message: validationErrors.errors[0].msg,
      });
    }

    const videoId = req.params.id;
    if (!videoId) {
      return res.status(400).json({
        status: 400,
        message: "Video ID is required",
      });
    }

    const {
      title,
      description,
      tags,
      type,
      courseId,
      chapter,
      fileType,
      videoURL,
    } = req.body;
    const demo = req.body.demo === "true" || req.body.demo === true;
    const videoFilePath =
      req.files && req.files.videofile ? req.files.videofile[0].path : null;
    const encodedVideoURL = videoURL ? encodeUrl(videoURL) : null;
    try {
      const video = await Video.findById(videoId);
      if (!video) {
        return res.status(404).json({
          status: 404,
          message: "Video not found",
        });
      }

      const token = req.headers.authorization.split(" ")[1];
      const SECRET_KEY = await getSecretKey();
      const decodedToken = jwt.verify(token, SECRET_KEY);
      const adminId = decodedToken.id;

      const admin = await adminModel.findById(adminId);
      if (!admin || !mongoose.Types.ObjectId.isValid(adminId)) {
        return res.status(401).json({
          status: 401,
          message: "Admin not found",
        });
      }

      const createdBy = admin.name;

      if (!demo && video.demoVideofile) {
        if (fs.existsSync(video.demoVideofile)) {
          fs.unlinkSync(video.demoVideofile);
        }
        video.demoVideofile = null;
      }

      const deleteFile = (filePath) => {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      };

      if (req.files["videofile"]) {
        if (video.videoURL) {
          deleteFile(video.videoURL);
          video.videoURL = null;
        }
        deleteFile(video.pdf);
        deleteFile(video.ppt);
        deleteFile(video.doc);
        deleteFile(video.demoVideofile);
        video.pdf = null;
        video.ppt = null;
        video.doc = null;
      }

      if (videoURL) {
        if (video.videofile) {
          deleteFile(video.thumbnail);
          deleteFile(video.videofile);
          video.videofile = null;
        }
      }

      if (req.files["pdf"] || req.files["ppt"] || req.files["doc"]) {
        if (video.videofile) {
          deleteFile(video.videofile);
          deleteFile(video.thumbnail);
          deleteFile(video.encodedVideoURL);
          deleteFile(video.demoVideofile);
          video.videofile = null;
          video.demoVideofile = null;
          video.thumbnail = null;
        }
      }

      video.title = title || video.title;
      video.description = description || video.description;
      video.tags = tags || video.tags;
      video.demo = demo;
      if (demo && videoFilePath) {
        video.demoVideofile = videoFilePath;
      }
      video.videoURL = encodedVideoURL;
      video.type = type || video.type;
      video.fileType = fileType || video.fileType;
      video.chapter = chapter || video.chapter;
      video.courseId = courseId || video.courseId;
      video.createdBy = createdBy;

      if (type === "document") {
        if (req.files["pdf"]) {
          video.pdf = req.files["pdf"][0].path;
        }
        if (req.files["ppt"]) {
          video.ppt = req.files["ppt"][0].path;
        }
        if (req.files["doc"]) {
          video.doc = req.files["doc"][0].path;
        }
      }

      if (type === "video" && videoFilePath) {
        if (req.files["thumbnail"]) {
          video.thumbnail = req.files["thumbnail"][0].path;
        }
        if (req.files["videofile"]) {
          video.videofile = req.files["videofile"][0].path;

          const videoFilePath = video.videofile;
          const videoFileName = path.basename(
            videoFilePath,
            path.extname(videoFilePath)
          );
          const outputDir = path.join(
            __dirname,
            "../../public/videos",
            courseId,
            chapter
          );

          if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
          }

          const manifestPath = path.join(outputDir, `${videoFileName}.mpd`);

          await new Promise((resolve, reject) => {
            exec(
              `MP4Box -dash 20000 -frag 20000 -rap -profile live -out "${manifestPath}" "${videoFilePath}"`,
              (error, stdout, stderr) => {
                if (error) {
                  return reject(`Error generating DASH manifest: ${stderr}`);
                }
                resolve();
              }
            );
          });

          const manifestUrl = `${process.env.BASE_URL}/public/videos/${courseId}/${chapter}/${videoFileName}.mpd`;
          video.videofile = manifestUrl;
        }
      }

      const updatedVideo = await video.save();
      return res.json({
        status: 200,
        message: "Video updated successfully",
        video: updatedVideo,
      });
    } catch (error) {
      return res.status(404).json({
        status: 404,
        message: "Failed to update video",
        error: error.message,
      });
    }
  });
};

const coursechapters = async (req, res) => {
  try {
    const { courseId } = req.params;
    const course = await Course.findById(courseId).populate("chapters");
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }
    res.json({ chapters: course.chapters });
  } catch (error) {
    res.status(404).json({
      status: 404, 
      message: "Failed to fetch chapters" 
    });
  }
};

const deleteVideo = async (req, res) => {
  const videoId = req.params.id;
  const { courseId, chapter } = req.body;

  if (!videoId) {
    return res.status(400).json({
      status: 400,
      error: "Video ID is required",
    });
  }

  try {
    const video = await Video.findById(videoId);
    if (!video) {
      return res.status(404).json({
        status: 404,
        error: "Video not found",
      });
    }

    const courseId = video.courseId.toString();
    const chapter = video.chapter;

    const enrollmentCount = await Enrollment.countDocuments({ courseId });
    if (enrollmentCount > 0) {
      return res.status(400).json({
        status: 400,
        error: "Cannot delete video. There are users enrolled in this course.",
      });
    }

    const deleteFile = (filePath) => {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      } else {
        console.error(`File not found: ${filePath}`);
      }
    };

    const deleteDirectory = (dirPath) => {
      if (fs.existsSync(dirPath)) {
        fs.rmdirSync(dirPath, { recursive: true });
      } else {
        console.error(`Directory not found: ${dirPath}`);
      }
    };

    if (video.pdf) {
      const pdfPath = path.join(video.pdf);
      deleteFile(pdfPath);
    }

    if (video.ppt) {
      const pptPath = path.join(video.ppt);
      deleteFile(pptPath);
    }

    if (video.doc) {
      const docPath = path.join(video.doc);
      deleteFile(docPath);
    }

    if (video.thumbnail) {
      deleteFile(video.thumbnail);
    }

    if (video.videofile) {
      const videoFolderPath = path.join(
        __dirname,
        "../../public/videos",
        courseId,
        chapter,
        path.basename(video.videofile, path.extname(video.videofile))
      );

      deleteDirectory(videoFolderPath);
      deleteFile(video.videofile);
    }

    if (video.demoVideofile) {
      deleteFile(video.demoVideofile);
    }

    await Video.findByIdAndDelete(videoId);

    res.json({ message: "Video and associated files deleted successfully" });
  } catch (error) {
    res.status(404).json({
      status: 404,
      error: "Server error while deleting video",
    });
  }
};

const updateVideoOrder = async (req, res) => {
  const { videos } = req.body;

  if (!Array.isArray(videos)) {
    return res.status(400).json({
      status: 400,
      message: "Invalid data format. 'videos' should be an array.",
    });
  }

  try {
    for (const video of videos) {
      await Video.updateOne(
        { _id: video._id },
        { $set: { order: video.order } }
      );
    }
    res
      .status(200)
      .json({ status: 200, message: "Video order updated successfully" });
  } catch (error) {
    res
      .status(404)
      .json({ status: 404, message: "Error updating video order" });
  }
};

const videotoggleButton = async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) {
      return res.json({
        status: 404,
        message: "Video not found",
      });
    }
    video.active = !video.active;
    await video.save();
    res.json({
      status: 200,
      video,
    });
  } catch (error) {
    res.json({
      status: 404,
      message: "Server error",
    });
  }
};

const updateVideoProgress = async (req, res) => {
  try {
    const { userId, videoId, courseId, progress, percentage } = req.body;

    if (!userId || !videoId || !courseId || typeof progress !== "number") {
      return res.status(400).json({
        status: 400,
        message: "Invalid input data",
      });
    }

    if (progress < 0 || progress > 100) {
      return res.status(400).json({
        status: 400,
        message: "Progress must be between 0 and 100",
      });
    }

    let videoProgress = await VideoProgress.findOne({ userId, videoId });

    if (videoProgress) {
      if (progress > videoProgress.progress) {
        videoProgress.progress = progress;
        videoProgress.completed = progress >= percentage;
        videoProgress.updatedAt = Date.now();
        await videoProgress.save();
      } else {
        return res.status(200).json({
          status: 401,
          message: "Progress should be greater than cureent video progress.",
        });
      }
    } else {
      videoProgress = new VideoProgress({
        userId,
        videoId,
        courseId,
        progress,
        completed: progress >= percentage,
      });
      await videoProgress.save();
    }

    return res.status(200).json({
      status: 200,
      message: "Video progress updated successfully",
    });
  } catch (error) {
    return res.status(404).json({
      status: 404,
      message: "Failed to update video progress",
    });
  }
};

module.exports = {
  createVideo,
  getAllVideos,
  getVideosByCourse,
  updateVideoDetails,
  coursechapters,
  deleteVideo,
  updateVideoOrder,
  videotoggleButton,
  updateVideoProgress,
};
