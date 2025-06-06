const nodemailer = require("nodemailer");

const sendEmail = async (emailRequest) => {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: `"Garbhsanskar Guru" <${process.env.EMAIL_USER}>`,
      to: emailRequest.email,
      subject: emailRequest.subject,
      html: `<pre style="white-space: pre-wrap;">${emailRequest.content}</pre>`,
      attachments: emailRequest.attachments || [],
    };

    const info = await transporter.sendMail(mailOptions);

    console.log("✅ Email sent:", info.messageId);

    return {
      data: {
        status: 200,
        message: "Email sent successfully",
      },
    };
  } catch (error) {
    console.error("❌ Email sending failed:", error.message);
    return {
      data: {
        status: 500,
        message: error.message,
      },
    };
  }
};

module.exports = {
  sendEmail,
};
