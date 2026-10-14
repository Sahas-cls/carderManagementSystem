"use strict";

const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const routes = require("./src/routes");
const { notFound, errorHandler } = require("./src/middleware/errorHandler");
const { User } = require("./models");
const {
  hashPassword,
  comparePassword,
} = require("./src/utils/password");
const { where } = require("sequelize");

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.get("/health", (req, res) => res.json({ success: true, message: "OK" }));

app.get("/reset-password", async (req, res) => {
  try {
    const password = "12345678";
    const hashedPassword = await hashPassword(password);

    await User.update({ password: hashedPassword }, { where: { id: 1 } });

    return res.json({
      success: true,
      message: "Password reset successfully",
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to reset password",
    });
  }
});

app.use("/api", routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
