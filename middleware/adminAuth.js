const jwt = require("jsonwebtoken");

async function getSecretKey() {
  try {
    return process.env.SECRET_KEY;
    
  } catch (error) {
    throw new Error("Could not retrieve SECRET_KEY");
  }
}

const auth = async (req, res, next) => {
  const SECRET_KEY = await getSecretKey();
  try {
    let token = req.headers.authorization;
    if (token) {
      token = token.split(" ")[1];
      let admin = jwt.verify(token, SECRET_KEY);
      req.adminId = admin.id;
      next();
    } else {
      return res.json({
        status: 401,
        message: "Unauthorized Admin",
      });
    }
  } catch (error) {
    res.json({
      status: 401,
      message: "Unauthorized Admin",
    });
  }
};

module.exports = auth;
