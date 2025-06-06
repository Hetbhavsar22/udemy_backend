const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const adminModel = require("../../Model/adminModel");
const jwt = require("jsonwebtoken");
const upload = require("../../middleware/upload");

async function getSecretKey() {
  try {
    return process.env.SECRET_KEY;
  } catch (error) {
    throw new Error("Could not retrieve SECRET_KEY");
  }
}

const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const authHeader = req.headers.authorization;

  if (!currentPassword || !newPassword) {
    return res.json({
      status: 400,
      message: "Current password and new password are required",
    });
  }

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.json({
      status: 401,
      message: "Authorization header missing or malformed",
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const SECRET_KEY = await getSecretKey();
    const decodedToken = jwt.verify(token, SECRET_KEY);
    const adminId = decodedToken.id;

    const existingAdmin = await adminModel.findById(adminId);
    if (!existingAdmin) {
      return res.json({
        status: 404,
        message: "Admin not found!",
      });
    }

    const isCurrentPasswordCorrect = await bcrypt.compare(
      currentPassword,
      existingAdmin.password
    );

    if (!isCurrentPasswordCorrect) {
      return res.json({
        status: 401,
        message: "Current password is incorrect!",
      });
    }

    if (newPassword.length < 6) {
      return res.json({
        status: 400,
        message: "New password must be at least 6 characters long",
      });
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    existingAdmin.password = hashedNewPassword;
    await existingAdmin.save();

    res.json({
      status: 200,
      message: "Password changed successfully!",
    });
  } catch (error) {
    res.json({
      status: 404,
      message: "Server error",
      error: error.message,
    });
  }
};

const updateDetails = async (req, res) => {
  upload(req, res, async (err) => {
    if (err) {
      return res.json({
        status: 400,
        message: "File upload error",
        error: err.message,
      });
    }

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.json({
        status: 401,
        message: "Authorization header missing or malformed",
      });
    }

    const token = authHeader.split(" ")[1];

    try {
      const SECRET_KEY = await getSecretKey();
      const decodedToken = jwt.verify(token, SECRET_KEY);
      const adminId = decodedToken.id;

      const adminDetail = await adminModel.findById(adminId);
      if (!adminDetail) {
        return res.json({
          status: 404,
          message: "Admin not found!",
        });
      }

      const { name, email } = req.body;

      if (name && typeof name !== "string") {
        return res.json({
          status: 400,
          message: "Invalid name format. Name should be a string.",
        });
      }

      if (name) {
        adminDetail.name = name;
      }
      if (email) {
        adminDetail.email = email;
      }

      if (req.files && req.files.profileImage && req.files.profileImage[0]) {
        const file = req.files.profileImage[0];
        if (file.mimetype.startsWith("image/")) {
          adminDetail.profile_image = `/profile_images/${file.filename}`;
        } else {
          return res.json({
            status: 400,
            message: "Invalid file type. Only images are allowed.",
          });
        }
      }

      await adminDetail.save();

      res.json({
        status: 200,
        message: "Details updated successfully!",
        data: {
          id: adminDetail._id,
          name: adminDetail.name,
          email: adminDetail.email,
          profile_image: adminDetail.profile_image,
          token: token,
        },
      });
    } catch (error) {
      res.json({
        status: 404,
        message: "Server error",
        error: error.message,
      });
    }
  });
};

module.exports = { changePassword, updateDetails };
