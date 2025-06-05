const jwt = require("jsonwebtoken");
const userModel = require("../Model/userModel");
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

const checkSession = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({
        status: 401,
        message: "Authorization header missing. Please log in again.",
      });
    }

    const token = authHeader.split(" ")[1];
    const SECRET_KEY = await getSecretKey();
    const decodedToken = jwt.verify(token, SECRET_KEY);
    const userId = decodedToken.id;

    const userDetail = await userModel.findById(userId);
    if (!userDetail || userDetail.token !== token) {
      return res.status(401).json({
        status: 401,
        message: "Invalid session. Please log in again.",
      });
    }

    const currentTime = Math.floor(Date.now() / 1000);
    if (decodedToken.exp < currentTime) {
      return res.status(401).json({
        status: 401,
        message: "Session expired. Please log in again.",
      });
    }

    next();
  } catch (error) {
    return res.status(401).json({
      status: 401,
      message: "Invalid session. Please log in again.",
    });
  }
};

module.exports = checkSession;
