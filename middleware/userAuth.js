const jwt = require("jsonwebtoken");
const User = require("../Model/userModel");
const Settinginfo = require("../trait/SecretManager");

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

const authenticate = async (req, res, next) => {
  try {
    const token = req.header("Authorization").replace("Bearer ", "");
    if (!token) {
      return res.status(401).json({
        status: 401,
        message: "No token provided. Please authenticate.",
      });
    }

    const SECRET_KEY = await getSecretKey();
    const decoded = jwt.verify(token, SECRET_KEY);

    const user = await User.findOne({ _id: decoded.id });
    if (!user) {
      return res
        .status(401)
        .json({ status: 401, message: "User not found. Please authenticate." });
    }

    req.token = token;
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({
      status: 401,
      message: "Please authenticate.",
      error: error.message,
    });
  }
};

module.exports = authenticate;
