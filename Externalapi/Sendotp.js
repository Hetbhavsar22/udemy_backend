const axios = require("axios");
const sendMobileOTP = async (otpRequest) => {
  try {
    const response = await axios.post(
      `${process.env.EXTERNAL_API_URL}/send-sms`,
      otpRequest
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
  sendMobileOTP,
};
