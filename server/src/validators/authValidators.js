"use strict";

const ApiError = require("../utils/ApiError");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

function validateRegisterBody(req, res, next) {
  try {
    const { userName, email, password } = req.body || {};

    if (typeof userName !== "string" || !userName.trim()) {
      throw new ApiError(400, "userName is required.");
    }
    if (typeof email !== "string" || !EMAIL_RE.test(email.trim())) {
      throw new ApiError(400, "A valid email is required.");
    }
    if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
      throw new ApiError(400, `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    }

    req.body = { userName: userName.trim(), email: email.trim().toLowerCase(), password };
    next();
  } catch (err) {
    next(err);
  }
}

function validateLoginBody(req, res, next) {
  try {
    const { email, password } = req.body || {};

    if (typeof email !== "string" || !email.trim()) {
      throw new ApiError(400, "email is required.");
    }
    if (typeof password !== "string" || !password) {
      throw new ApiError(400, "password is required.");
    }

    req.body = { email: email.trim().toLowerCase(), password };
    next();
  } catch (err) {
    next(err);
  }
}

/** POST /auth/change-password body. */
function validateChangePasswordBody(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body || {};

    if (typeof currentPassword !== "string" || !currentPassword) {
      throw new ApiError(400, "currentPassword is required.");
    }
    if (typeof newPassword !== "string" || newPassword.length < MIN_PASSWORD_LENGTH) {
      throw new ApiError(400, `New password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    }
    if (newPassword === currentPassword) {
      throw new ApiError(400, "New password must be different from the current password.");
    }

    req.body = { currentPassword, newPassword };
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { validateRegisterBody, validateLoginBody, validateChangePasswordBody };
