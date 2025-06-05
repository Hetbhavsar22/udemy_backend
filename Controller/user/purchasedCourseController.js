const Course = require("../../Model/courseModel");
const Video = require("../../Model/videoModel");
const Enrollment = require("../../Model/enrollmentModel");
const User = require("../../Model/userModel");
const userModel = require("../../Model/userModel");
const VideoProgress = require("../../Model/VideoProgress");
const CoursePurchase = require("../../Model/coursePurchaseModel");
const Purchase = require("../../Model/coursePurchaseModel");

const getPurchasedCourseDetails = async (req, res) => {
  try {
    const { courseId, userId } = req.params;

    const enrollment = await Enrollment.findOne({ userId, courseId });
    if (!enrollment) {
      return res
        .status(403)
        .json({ message: "You are not enrolled in this course." });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: "Course not found." });
    }

    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    if (!userId) {
      return res.status(400).json({ message: "User ID are required." });
    }

    if (!courseId) {
      return res.status(400).json({ message: "Course ID are required." });
    }

    const videos = await Video.find({ courseId });

    if (videos.length === 0) {
      return res
        .status(404)
        .json({ message: "No resources available for this course." });
    }

    const videoProgressData = await VideoProgress.find({ userId, courseId });

    const coursePurchase = await CoursePurchase.findOne({ courseId, userId });

    if (userId && userId !== "null") {
      const enrollments = await Enrollment.find({ userId });
      const enrolledCourseIds = enrollments.map((enrollment) =>
        enrollment.courseId.toString()
      );

      const purchase = await Purchase.findOne({ userId, courseId: course._id });
      const active = purchase ? purchase.active : false;

      const courseStartTime = new Date(course.startTime); // Convert to Date object

// Get the current date
const currentDate = new Date();

// Set the new date to the current date but keep the time from course.startTime
const updatedStartTime = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), courseStartTime.getHours(), courseStartTime.getMinutes(), courseStartTime.getSeconds());

      const courseDetails = {
        courseId: course._id,
        currentTime: new Date().toISOString(),
        cname: course.cname,
        description: course.shortDescription,
        longDescription: course.longDescription,
        courseImage: course.courseImage,
        previewVideofile: course.previewVideofile,
        learn: course.learn,
        hours: course.hours,
        author: course.author,
        totalVideo: course.totalVideo,
        language: course.language,
        price: course.price,
        dprice: course.dprice,
        courseType: course.courseType,
        percentage: course.percentage,
        startTime: updatedStartTime.toISOString(),
        endTime: course.endTime,
        transactionDate: coursePurchase ? coursePurchase.transactionDate : null,
        isEnrolled: enrolledCourseIds.includes(course._id.toString()),
        active: active,
        chapters: course.chapters.map((chapter) => ({
          chapterName: chapter.name,
          resources: videos
            .filter((video) => video.chapter === chapter.name)
            .map((video) => {
              let decodedVideoURL = null;
              if (video.videoURL) {
                try {
                  decodedVideoURL = Buffer.from(
                    video.videoURL,
                    "base64"
                  ).toString("utf-8");
                } catch (error) {
                  decodedVideoURL = null;
                }
              }
              const videoProgress = videoProgressData.find((progress) =>
                progress.videoId.equals(video._id)
              );
              return {
                videoId: video._id,
                title: video.title,
                description: video.description,
                demo: video.demo,
                demoVideofile: video.demoVideofile,
                thumbnail: video.thumbnail,
                videofile: video.videofile,
                fileType: video.fileType,
                videoURL: decodedVideoURL,
                pdf: video.pdf,
                ppt: video.ppt,
                doc: video.doc,
                tags: video.tags,
                type: video.type,
                order: video.order,
                progress: videoProgress ? videoProgress.progress : 0,
                completed: videoProgress ? videoProgress.completed : false,
                active: video.active
              };
            })
            .sort((a, b) => b.order - a.order),
        })),
      };

      res.json({
        status: 200,
        courseDetails,
      });
    }
  } catch (error) {
    res.status(404).json({
      status: 404, 
      message: "Server error", 
      error 
    });
  }
};

const getCourseDetails = async (req, res) => {
  try {
    const { courseId, userId } = req.params;

    if (!courseId) {
      return res.status(400).json({ message: "Course ID is required." });
    }

    // Fetch course details
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: "Course not found." });
    }

    // Fetch videos for the course
    const videos = await Video.find({ courseId });
    if (videos.length === 0) {
      return res
        .status(404)
        .json({ message: "No resources available for this course." });
    }

    // Initialize purchase and enrollment status
    let enrolledCourseIds = [];
    let purchase = null;

    if (userId && userId !== "null") {
      // Fetch enrollments for the user
      const enrollments = await Enrollment.find({ userId });
      enrolledCourseIds = enrollments.map((enrollment) =>
        enrollment.courseId.toString()
      );

      // Fetch purchase details for the user
      purchase = await Purchase.findOne({
        userId,
        courseId: course._id,
      });
    }

    // Prepare course details response
    const courseDetails = {
      courseId: course._id,
      cname: course.cname,
      description: course.shortDescription,
      longDescription: course.longDescription,
      courseImage: course.courseImage,
      previewVideofile: course.previewVideofile,
      learn: course.learn,
      hours: course.hours,
      author: course.author,
      totalVideo: course.totalVideo,
      language: course.language,
      price: course.price,
      dprice: course.dprice,
      courseType: course.courseType,
      percentage: course.percentage,
      startTime: course.startTime,
      endTime: course.endTime,
      isEnrolled: enrolledCourseIds.includes(course._id.toString()),
      chapters: course.chapters.map((chapter) => ({
        chapterName: chapter.name,
        resources: videos
          .filter((video) => video.chapter === chapter.name)
          .map((video) => ({
            videoId: video._id,
            title: video.title,
            description: video.description,
            fileType: video.fileType,
            demo: video.demo,
            demoVideofile: video.demoVideofile,
            thumbnail: video.thumbnail,
            videofile: video.videofile,
            videoURL: video.videoURL,
            pdf: video.pdf,
            ppt: video.ppt,
            doc: video.doc,
            tags: video.tags,
            type: video.type,
          })),
      })),
    };

    // Conditionally add purchase and expire details if user is logged in
    if (userId && userId !== "null") {
      courseDetails.courseExpireTime = purchase
        ? purchase.courseExpireTime
        : null;
      courseDetails.never = course.never;
      courseDetails.expire_days = course.expire_days;
    }

    res.json({
      status: 200,
      courseDetails,
    });
  } catch (error) {
    res.status(404).json({
      status: 404, 
      message: "Server error", 
      error 
    });
  }
};

module.exports = {
  getPurchasedCourseDetails,
  getCourseDetails,
};
