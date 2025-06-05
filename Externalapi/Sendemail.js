const axios = require("axios");
const sendEmail = async (emailRequest) => {
  try {
    const response = await axios.post(
      `${process.env.EXTERNAL_API_URL}/send-email`,
      emailRequest
    );
    return response;
  } catch (error) {
    return {
      data: {
        status: 401,
        message: error.message,
      },
    };
  }
};
module.exports = {
  sendEmail,
};
