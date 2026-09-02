"use strict";

const asyncHandler = require("../utils/asyncHandler");
const authService = require("../services/authService");

// POST /api/auth/register
const register = asyncHandler(async (req, res) => {
  const user = await authService.register(req.body);
  res.status(201).json({
    success: true,
    data: { user },
    message: "Account created. An administrator needs to activate it before you can log in.",
  });
});

// POST /api/auth/login
const login = asyncHandler(async (req, res) => {
  const { user, token } = await authService.login(req.body);
  res.json({ success: true, data: { user, token } });
});

// GET /api/auth/me
const me = asyncHandler(async (req, res) => {
  res.json({ success: true, data: { user: req.user } });
});

module.exports = { register, login, me };
