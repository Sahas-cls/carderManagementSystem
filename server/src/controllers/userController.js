"use strict";

const asyncHandler = require("../utils/asyncHandler");
const userService = require("../services/userService");

// GET /api/users
const getUsers = asyncHandler(async (req, res) => {
  const users = await userService.listUsers();
  res.json({ success: true, data: users });
});

// PATCH /api/users/:id
const updateUser = asyncHandler(async (req, res) => {
  const user = await userService.updateUser(req.params.id, req.body, req.user.id);
  res.json({ success: true, data: user });
});

// PATCH /api/users/:id/status
const setUserStatus = asyncHandler(async (req, res) => {
  const user = await userService.setActiveStatus(req.params.id, req.body.isActive, req.user.id);
  res.json({ success: true, data: user });
});

// POST /api/users/:id/reset-password
const resetPassword = asyncHandler(async (req, res) => {
  const { user, tempPassword } = await userService.resetPassword(req.params.id);
  res.json({ success: true, data: { user, tempPassword } });
});

// DELETE /api/users/:id
const deleteUser = asyncHandler(async (req, res) => {
  await userService.deleteUser(req.params.id, req.user.id);
  res.json({ success: true, data: null });
});

module.exports = { getUsers, updateUser, setUserStatus, resetPassword, deleteUser };
