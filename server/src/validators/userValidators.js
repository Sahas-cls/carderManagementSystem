"use strict";

const ApiError = require("../utils/ApiError");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateIdParam(req, res, next) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return next(new ApiError(400, "id must be a positive integer."));
  }
  req.params.id = id;
  next();
}

/** PATCH /users/:id body - userName/email/userRole are all optional, but at least one must be present. */
function validateUpdateUserBody(req, res, next) {
  try {
    const body = req.body || {};
    const parsed = {};

    if (body.userName !== undefined) {
      if (typeof body.userName !== "string" || !body.userName.trim()) {
        throw new ApiError(400, "userName cannot be empty.");
      }
      parsed.userName = body.userName.trim();
    }

    if (body.email !== undefined) {
      if (typeof body.email !== "string" || !EMAIL_RE.test(body.email.trim())) {
        throw new ApiError(400, "A valid email is required.");
      }
      parsed.email = body.email.trim().toLowerCase();
    }

    if (body.userRole !== undefined) {
      const roleId = Number(body.userRole);
      if (!Number.isInteger(roleId) || roleId <= 0) {
        throw new ApiError(400, "userRole must be a positive integer.");
      }
      parsed.userRole = roleId;
    }

    if (body.factoryId !== undefined) {
      if (body.factoryId === null || body.factoryId === "") {
        parsed.factoryId = null;
      } else {
        const factoryId = Number(body.factoryId);
        if (!Number.isInteger(factoryId) || factoryId <= 0) {
          throw new ApiError(400, "factoryId must be a positive integer or null.");
        }
        parsed.factoryId = factoryId;
      }
    }

    if (Object.keys(parsed).length === 0) {
      throw new ApiError(400, "Nothing to update.");
    }

    req.body = parsed;
    next();
  } catch (err) {
    next(err);
  }
}

/** PATCH /users/:id/status body. */
function validateStatusBody(req, res, next) {
  if (typeof req.body?.isActive !== "boolean") {
    return next(new ApiError(400, "isActive must be true or false."));
  }
  next();
}

module.exports = { validateIdParam, validateUpdateUserBody, validateStatusBody };
