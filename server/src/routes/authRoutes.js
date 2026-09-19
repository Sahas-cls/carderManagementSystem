"use strict";

const { Router } = require("express");
const { register, login, me, changePassword } = require("../controllers/authController");
const {
  validateRegisterBody,
  validateLoginBody,
  validateChangePasswordBody,
} = require("../validators/authValidators");
const { requireAuth } = require("../middleware/auth");

const router = Router();

router.post("/register", validateRegisterBody, register);
router.post("/login", validateLoginBody, login);
router.get("/me", requireAuth, me);
router.post("/change-password", requireAuth, validateChangePasswordBody, changePassword);

module.exports = router;
