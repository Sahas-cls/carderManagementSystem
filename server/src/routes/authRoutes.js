"use strict";

const { Router } = require("express");
const { register, login, me } = require("../controllers/authController");
const { validateRegisterBody, validateLoginBody } = require("../validators/authValidators");
const { requireAuth } = require("../middleware/auth");

const router = Router();

router.post("/register", validateRegisterBody, register);
router.post("/login", validateLoginBody, login);
router.get("/me", requireAuth, me);

module.exports = router;
