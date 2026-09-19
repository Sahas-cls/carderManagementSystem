"use strict";

const { User, UserRole, Factory } = require("../../models");
const ApiError = require("../utils/ApiError");
const { hashPassword, comparePassword } = require("../utils/password");
const { signToken } = require("../utils/token");

const DEFAULT_ROLE_NAME = "User";

/** Registers a new account. Always starts isActive=false - an admin has to activate it before login works. */
async function register({ userName, email, password }) {
  const existing = await User.findOne({ where: { email } });
  if (existing) {
    throw new ApiError(409, "An account with this email already exists.");
  }

  const defaultRole = await UserRole.findOne({ where: { userRole: DEFAULT_ROLE_NAME } });
  if (!defaultRole) {
    // Set up by the create-user-role migration/seed; a missing role here means the environment isn't set up yet.
    throw new ApiError(500, `Default "${DEFAULT_ROLE_NAME}" role is not configured. Contact an administrator.`);
  }

  const passwordHash = await hashPassword(password);
  const user = await User.create({
    userName,
    email,
    password: passwordHash,
    userRole: defaultRole.roleId,
    isActive: false,
  });

  return user;
}

/** Verifies credentials and, if the account is active, returns { user, token }. */
async function login({ email, password }) {
  const user = await User.findOne({
    where: { email },
    include: [
      { model: UserRole, as: "role" },
      { model: Factory, as: "factory", attributes: ["id", "factoryName"] },
    ],
  });
  if (!user) {
    throw new ApiError(401, "Invalid email or password.");
  }

  const valid = await comparePassword(password, user.password);
  if (!valid) {
    throw new ApiError(401, "Invalid email or password.");
  }

  if (!user.isActive) {
    throw new ApiError(403, "Your account is pending admin activation. Please try again later.");
  }

  await user.update({ lastLoginAt: new Date() });

  const token = signToken({ sub: user.id });
  return { user, token };
}

/**
 * Self-service password change. Used both for a voluntary change and to
 * clear a mustChangePassword flag set by userService.resetPassword - either
 * way the caller must know the current (possibly temporary) password.
 */
async function changePassword(userId, { currentPassword, newPassword }) {
  const user = await User.findByPk(userId);
  if (!user) {
    throw new ApiError(401, "Invalid or expired session. Please log in again.");
  }

  const valid = await comparePassword(currentPassword, user.password);
  if (!valid) {
    throw new ApiError(400, "Current password is incorrect.");
  }

  user.password = await hashPassword(newPassword);
  user.mustChangePassword = false;
  await user.save();
}

module.exports = { register, login, changePassword };
