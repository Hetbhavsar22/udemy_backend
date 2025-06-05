const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const adminModel = require("../../Model/adminModel");
const Settinginfo = require("../../trait/SecretManager");
const { body, validationResult } = require("express-validator");
require("dotenv").config();
const sendOTPObj = require("../../Externalapi/Sendotp");

const { ObjectId } = require("mongodb");

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


const register = async (req, res) => {
  try {
    await Promise.all([
      body("name").notEmpty().withMessage("Name is required").run(req),
      body("country_code").isNumeric().withMessage("Country code must be a number").run(req), 
      body("mobile_number").notEmpty().withMessage("Mobile number is required").run(req),
      body("email").isEmail().withMessage("Valid email is required").run(req),
      body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters").run(req),
    ]);

    const validationErrors = validationResult(req);
    if (!validationErrors.isEmpty()) {
      return res.status(400).json({ errors: validationErrors.array() });
    }

    const { name, country_code, mobile_number, email, password } = req.body;

    const existingAdmin = await adminModel.findOne({ email });
    if (existingAdmin) {
      return res.status(400).json({ message: "Admin with this email already exists." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newAdmin = new adminModel({
      name,
      country_code,
      mobile_number,
      email,
      password: hashedPassword,
    });

    await newAdmin.save();

    return res.status(201).json({ message: "Admin registered successfully", admin: newAdmin });
  } catch (error) {
    return res.json({
      status: 404, 
      message: "Internal server error"
    });
  }
};

const generateOTP = () => {
  return Math.floor(1000 + Math.random() * 9000).toString();
};
function generateOtpVerificationToken() {
  const objectId = new ObjectId();
  const hexString = objectId.toHexString();
  const uniqueString = hexString.padEnd(32, "0").substring(0, 32);
  return uniqueString;
}
const generateToken = async (adminDetail, browserFingerprint) => {
  const SECRET_KEY = await getSecretKey();
  const payload = {
    id: adminDetail._id,
    email: adminDetail.email,
    name: adminDetail.name,
    browserFingerprint: browserFingerprint,
    profile_image: adminDetail.profile_image,
    loginTime: Date.now(),
  };
  const token = jwt.sign(payload, SECRET_KEY, { expiresIn: "24h" });
  return token;
};

const login = async (req, res) => {
  try {
    await Promise.all([
      body("email")
        .notEmpty()
        .withMessage("Email is required")
        .isEmail()
        .withMessage("Please enter a valid email address.")
        .isLength({ max: 100 })
        .withMessage("Email address cannot exceed 100 characters.")
        .run(req),
      body("password").notEmpty().withMessage("Password is required").run(req),
      body("browserFingerprint")
        .notEmpty()
        .withMessage("Browser fingerprint is required")
        .run(req),
    ]);

    const validationErrorObj = validationResult(req);
    if (!validationErrorObj.isEmpty()) {
      return res.json({
        status: 401,
        message: validationErrorObj.errors[0].msg,
      });
    }

    const { email, password, browserFingerprint } = req.body;
    const adminDetail = await adminModel.findOne({ email });

    if (!adminDetail) {
      return res.json({
        status: 401,
        message: "Email Address not exists.",
      });
    }

    const isPasswordValid = await bcrypt.compare(
      password,
      adminDetail.password
    );
    if (!isPasswordValid) {
      return res.json({
        status: 401,
        message: "Invalid Password.",
      });
    }

    const currentBrowserFingerprint = browserFingerprint;
    const currentTime = new Date();
    const lastLoginTime = new Date(adminDetail.last_login_time);
    const timeLeft = currentTime - lastLoginTime;
    const currentDate = new Date();

    const diffInHours = timeLeft / (1000 * 60 * 60);

    if (
      diffInHours >= 24 ||
      diffInHours < 0 ||
      adminDetail.last_Browser_finger_print === null ||
      currentBrowserFingerprint !== adminDetail.last_Browser_finger_print[0]
    ) {
      if (adminDetail.last_Browser_finger_print !== currentBrowserFingerprint) {
        // adminDetail.last_Browser_finger_print = currentBrowserFingerprint;
        adminDetail.token = null;
      }
      adminDetail.otp = generateOTP();
      adminDetail.last_login_time = new Date(currentDate.getTime());

      adminDetail.otp_expire_time = new Date(currentDate.getTime() + 5 * 60000);
      adminDetail.verification_token = generateOtpVerificationToken();

      //Send otp to mobile number start
      // var otpParams = {
      //   country_code: adminDetail.country_code,
      //   phone_number: adminDetail.mobile_number,
      //   project_name: "course",
      //   message_type: "send_opt",
      //   variable: {
      //     "#var1": adminDetail.otp,
      //   },
      // };
      // var otpResponse = await sendOTPObj.sendMobileOTP(otpParams);
      // if (otpResponse.data.status !== 200) {
      //   return res.json({
      //     status: 401,
      //     message: 'Send otp issue.please try again later'
      //   });
      // }
      //Send otp to mobile number end

      await adminDetail.save();

      return res.json({
        status: 200,
        message: "An OTP has been sent to your registered mobile number.",
        data: {
          verification_token: adminDetail.verification_token,
          is_otp_required: true,
        },
      });
    } else {
      const token = await generateToken(adminDetail, browserFingerprint);
      adminDetail.token = token;
      adminDetail.last_login_time = new Date(currentDate.getTime());
      await adminDetail.save();

      return res.json({
        status: 200,
        message: "Login successful",
        data: {
          id: adminDetail._id,
          name: adminDetail.name,
          email: adminDetail.email,
          profile_image: adminDetail.profile_image,
          token: token,
          browserFingerprint: browserFingerprint,
        },
      });
    }
  } catch (error) {
    return res.json({
      status: 404,
      message: "An error occurred during login. Please try again later.",
    });
  }
};

const verifyOTP = async (req, res) => {
  try {
    await Promise.all([
      body("otp").notEmpty().withMessage("OTP is required").run(req),
      body("verification_token")
        .notEmpty()
        .withMessage("Verification token is required")
        .run(req),
    ]);

    const validationErrorObj = validationResult(req);
    if (!validationErrorObj.isEmpty()) {
      return res.json({
        status: 401,
        message: validationErrorObj.errors[0].msg,
      });
    }

    const { otp, verification_token, browserFingerprint } = req.body;

    const adminDetail = await adminModel.findOne({ verification_token });

    if (!adminDetail) {
      return res.json({
        status: 401,
        message: "The verification token you provided is invalid.",
      });
    }

    const currentDate = new Date();

    if (adminDetail.otp !== otp) {
      return res.json({
        status: 401,
        message: "Enter Valid OTP.",
      });
    }

    if (
      adminDetail.otp_expire_time &&
      currentDate > adminDetail.otp_expire_time
    ) {
      return res.json({
        status: 401,
        message: "The OTP has expired",
      });
    }

    const token = await generateToken(adminDetail, browserFingerprint);

    adminDetail.token = token;
    adminDetail.otp = null;
    adminDetail.verification_token = null;
    adminDetail.otp_expire_time = null;
    adminDetail.last_login_time = new Date(currentDate.getTime());
    adminDetail.last_Browser_finger_print = browserFingerprint;

    await adminDetail.save();

    return res.json({
      status: 200,
      message: "OTP verified successfully",
      data: {
        id: adminDetail._id,
        name: adminDetail.name,
        email: adminDetail.email,
        profile_image: adminDetail.profile_image,
        token: token,
        browserFingerprint: browserFingerprint,
      },
    });
  } catch (error) {
    return res.json({
      status: 401,
      message:
        "An error occurred during OTP verification. Please try again later.",
    });
  }
};

const resend_Otp = async (req, res) => {
  try {
    await Promise.all([
      body("verification_token")
        .notEmpty()
        .withMessage("Verification token is required")
        .run(req),
    ]);

    const validationErrorObj = validationResult(req);
    if (!validationErrorObj.isEmpty()) {
      return res.json({
        status: 401,
        message: validationErrorObj.errors[0].msg,
      });
    }

    const { verification_token } = req.body;
    const adminDetail = await adminModel.findOne({ verification_token });

    if (!adminDetail) {
      return res.json({
        status: 401,
        message: "The verification token you provided is invalid.",
      });
    }

    const currentDate = new Date();

    const otp = await generateOTP();
    adminDetail.otp = otp;
    adminDetail.otp_expire_time = new Date(currentDate.getTime() + 15 * 60000);

    await adminDetail.save();

    // Send OTP via SMS (commented out as per request)
    const otpParams = {
      country_code: adminDetail.country_code,
      phone_number: adminDetail.mobile_number,
      project_name: "course",
      message_type: "send_otp",
      variable: {
        "#var1": adminDetail.otp,
      },
    };
    try {
      const otpResponse = await sendOTPObj.sendMobileOTP(otpParams);
      if (otpResponse.data.status !== 200) {
        return res.json({
          status: 401,
          message: 'Failed to send OTP. Please try again later.',
        });
      }
    } catch (error) {
      return res.json({
        status: 404,
        message: 'Failed to send OTP. Please try again later.',
      });
    }

    return res.json({
      status: 200,
      message: "OTP has been resent successfully",
      data: {
        otp: adminDetail.otp,
      },
    });
  } catch (error) {
    return res.json({
      status: 404,
      message:
        "An error occurred while resending the OTP. Please try again later.",
    });
  }
};

const getAdminDetails = async (req, res) => {
  const SECRET_KEY = await getSecretKey();
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    const decoded = jwt.verify(token, SECRET_KEY);
    const adminDetail = await adminModel.findById(decoded.id);

    if (!adminDetail) {
      return res.json({
        status: 404,
        message: "Admin not found",
      });
    }

    return res.json({
      status: 200,
      message: "Admin data fetched successfully",
      data: {
        id: adminDetail._id,
        name: adminDetail.name,
        email: adminDetail.email,
        active: adminDetail.active,
        profile_image: adminDetail.profile_image,
      },
    });
  } catch (error) {
    return res.json({
      status: 404,
      message: "An internal server error occurred.",
    });
  }
};

const getAdminById = async (req, res) => {
  try {
    const token = req.headers.authorization.split(" ")[1];
    const SECRET_KEY = await getSecretKey();
    const decodedToken = jwt.verify(token, SECRET_KEY);
    const adminId = decodedToken.id;

    const adminDetail = await adminModel.findById(adminId);
    if (!adminDetail) {
      return res.json({
        status: 404,
        message: "Admin not found",
      });
    }

    res.json({
      status: 200,
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
      message: "An error occurred while fetching admin details.",
    });
  }
};

const verifyToken = async (req, res, next) => {
  const token = req.headers["authorization"]?.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      status: 401,
      message: "Access denied. No token provided.",
    });
  }

  try {
    const SECRET_KEY = await getSecretKey();
    const decoded = jwt.verify(token, SECRET_KEY);

    const { id, browserFingerprint } = decoded;

    const adminDetail = await adminModel.findById(id);

    if (!adminDetail) {
      return res.json({
        status: 404,
        message: "Admin not found",
      });
    }

    const currentTime = new Date();
    const lastLoginTime = new Date(adminDetail.last_login_time);
    const timeLeft = currentTime - lastLoginTime;

    const diffInHours = timeLeft / (1000 * 60 * 60);

    const isAdminRequest = req.originalUrl.startsWith("/admin");

    if (isAdminRequest) {
      if (diffInHours >= 24 || diffInHours < 0) {
        return res.status(401).json({
          status: 401,
          message: "OTP verification required after 24 hours.",
          is_otp_required: true,
        });
      }

      if (diffInHours >= 1) {
        return res.status(401).json({
          status: 401,
          message:
            "Please log in with email and password after 1 hour of inactivity.",
        });
      }

      if (browserFingerprint !== adminDetail.last_Browser_finger_print[0]) {
        return res.status(401).json({
          status: 401,
          message: "You must login in to one browser only",
        });
      }
    }

    req.user = {
      id: adminDetail._id,
      email: adminDetail.email,
      name: adminDetail.name,
      profile_image: adminDetail.profile_image,
      browserFingerprint: adminDetail.last_Browser_finger_print,
    };
    res.status(200).json({
      status: 200,
      message: "Verify Successfull",
    });
    next();
  } catch (error) {
    return res.status(401).json({
      status: 401,
      message: "Invalid or expired token. Please log in again.",
    });
  }
};

const logout = async (req, res) => {
  const token = req.headers["authorization"]?.split(" ")[1];
  const SECRET_KEY = await getSecretKey();
  const decoded = jwt.verify(token, SECRET_KEY);

  const { id, browserFingerprint } = decoded;

  const adminDetail = await adminModel.findById(id);

  if (!adminDetail) {
    return res.json({
      status: 404,
      message: "Admin not found",
    });
  }
  adminDetail.token = null;
  adminDetail.last_login_time = null;
  adminDetail.last_Browser_finger_print = null;
  await adminDetail.save();

  return res.json({
    status: 200,
    message: "Logout Successfully",
    data: {
      id: adminDetail._id,
      name: adminDetail.name,
      email: adminDetail.email,
      profile_image: adminDetail.profile_image,
      token: token,
    },
  });
};

const addAdmin = async (req, res) => {
  try {
    const { name, email, password, country_code, mobile_number } = req.body;

    if (!name || !email || !password || !country_code || !mobile_number) {
      return res.status(400).json({ message: "All fields are required." });
    }

    const existingAdmin = await adminModel.findOne({ email });
    if (existingAdmin) {
      return res.status(400).json({ message: "Admin already exists." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newAdmin = new adminModel({
      name,
      email,
      password: hashedPassword,
      country_code,
      mobile_number
    });

    await newAdmin.save();

    return res
      .status(201)
      .json({ message: "Admin added successfully.", data: newAdmin });
  } catch (error) {
    return res
      .status(404)
      .json({ message: "An error occurred while adding the admin." });
  }
};

const deleteAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    const adminToDelete = await adminModel.findById(id);
    if (!adminToDelete) {
      return res.status(404).json({ message: "Admin not found." });
    }

    await adminModel.findByIdAndDelete(id);

    return res.status(200).json({ message: "Admin deleted successfully." });
  } catch (error) {
    return res
      .status(404)
      .json({ message: "An error occurred while deleting the admin." });
  }
};

const getAllAdmins = async (req, res) => {
  try {
    const {
      search,
      page,
      limit,
      sortBy = "createdAt",
      order = "desc",
      active,
    } = req.query;
    
    const query = {};

    if (active === "true") {
      query.active = true;
    } else if (active === "false") {
      query.active = false;
    }

    if (search) {
      const searchRegex = new RegExp(search, "i");
      query.$or = [
        { name: searchRegex },
        { email: searchRegex },
        {
          $expr: {
            $regexMatch: {
              input: {  $concat: [
                { $ifNull: [{ $toString: "$country_code" }, ""] },
                { $ifNull: [{ $toString: "$mobile_number" }, ""] }
              ]},
              regex: search,
              options: "i",
            },
          },
        },
      ];
    }

    const sortOrder = order.toLowerCase() === "asc" ? 1 : -1;

    const totalAdmin = await adminModel.countDocuments(query);

    const admins = await adminModel
      .find(query)
      .sort({ [sortBy]: sortOrder })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

      const admin = admins.map((admin) => ({
        _id: admin._id,
        name: admin.name,
        email: admin.email,
        mobile_number: `${admin.country_code || ""}${admin.mobile_number || ""}`,
        active: admin.active,
        createdAt: admin.createdAt,
      }));

    return res.json({
      status: 200,
      admins: admin,
      totalAdmin,
    });
  } catch (error) {
    return res
      .status(404)
      .json({ 
        status: 404, 
        message: "An error occurred while fetching admins." 
      });
  }
};

const admintoggleButton = async (req, res) => {
  try {
    const admin = await adminModel.findById(req.params.id);
    if (!admin) {
      return res.json({
        status: 404,
        message: "Admin not found",
      });
    }
    admin.active = !admin.active;
    await admin.save();
    res.json({
      status: 200,
      admin,
    });
  } catch (error) {
    res.json({
      status: 404,
      message: "Server error",
    });
  }
};

module.exports = {
  register,
  login,
  verifyOTP,
  getAdminDetails,
  getAdminById,
  resend_Otp,
  verifyToken,
  logout,
  addAdmin,
  deleteAdmin,
  getAllAdmins,
  admintoggleButton,
};
