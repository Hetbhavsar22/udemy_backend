const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");
const Settinginfo = require("./trait/SecretManager");
require("dotenv").config();
const { generateInvoicePDF } = require("./Controller/user/invoiceController");

const adminRoutes = require("./route/adminRoutes");
const userRoutes = require("./route/userRoutes");

const app = express();
const PORT = process.env.PORT;

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.get("/generate-invoice-pdf", generateInvoicePDF);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  cors({
    // origin: "https://stgcourse.garbhsanskarguru.com",
    // origin: "http://localhost:3000",
    origin: ["http://192.168.1.13:3000", "http://192.168.1.10:3000" ],
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true,
  })
);

async function connectToDB() {
  let mongoURI;

  if (process.env.APP_ENV === "local") {
    mongoURI = process.env.DB_STRING;
  } else {
    const secretValue = await Settinginfo.getSecretValue([
      "COURSE_MONGO_DB_URL",
    ]);
    mongoURI = secretValue.COURSE_MONGO_DB_URL;
  }

  try {
    await mongoose.connect(mongoURI);
    console.log("MongoDB connected");
  } catch (err) {
    console.error("MongoDB connection error", err);
  }
}

connectToDB();
// mongoose
//   .connect(dbString, {
//     useNewUrlParser: true,
//     useUnifiedTopology: true,
//   })
//   .then(() => {
//     console.log("Connected to MongoDB");

//     app.listen(PORT, () => {
//       console.log(`Server started at port ${PORT}`);
//     });
//   })
//   .catch((error) => {
//     console.error("MongoDB connection error:", error);
//   });

app.use("/admin", adminRoutes);
app.use("/user", userRoutes);

app.use("/public", express.static(path.join(__dirname, "public")));
app.use("/public", express.static(path.join(__dirname, "../../public")));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.send(
    {
      status: 500,
    },
    "Something broke!"
  );
});

app.listen(PORT, () => {
  console.log(`Server started at port ${PORT}`);
});
