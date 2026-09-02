"use strict";

const asyncHandler = require("../utils/asyncHandler");
const userRoleService = require("../services/userRoleService");

const getUserRoles = asyncHandler(async (req, res) => {
  const roles = await userRoleService.getAllUserRoles();
  res.json({ success: true, data: roles });
});

module.exports = { getUserRoles };
