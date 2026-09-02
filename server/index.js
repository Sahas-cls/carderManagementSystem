"use strict";

require("dotenv").config();
const app = require("./app");
const db = require("./models");
const morgan = require("morgan");

// MIDDLEWARES
app.use(morgan());

const PORT = process.env.BACKEND_PORT || 4000;

db.sequelize
  .authenticate()
  .then(() => {
    console.log("Database connection established.");
    app.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Unable to connect to the database:", err);
    process.exit(1);
  });
