"use strict";

const { User, UserRole, Factory } = require("../../models");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { verifyToken } = require("../utils/token");

/** Requires a valid `Authorization: Bearer <token>` header; attaches the current user (with role) as req.user. */
const requireAuth = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    throw new ApiError(401, "Authentication required.");
  }

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    throw new ApiError(401, "Invalid or expired session. Please log in again.");
  }

  const user = await User.findByPk(payload.sub, {
    include: [
      { model: UserRole, as: "role" },
      { model: Factory, as: "factory", attributes: ["id", "factoryName"] },
    ],
  });
  if (!user) {
    throw new ApiError(401, "Invalid or expired session. Please log in again.");
  }
  if (!user.isActive) {
    throw new ApiError(403, "This account is pending admin activation.");
  }

  req.user = user;
  next();
});

/** Restricts a route to one of the given role names (e.g. requireRole("Administrator")). Use after requireAuth. */
function requireRole(...roleNames) {
  const allowed = new Set(roleNames.map((r) => r.toLowerCase()));
  return (req, res, next) => {
    const roleName = req.user?.role?.userRole;
    if (!roleName || !allowed.has(roleName.toLowerCase())) {
      return next(new ApiError(403, "You don't have permission to do that."));
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
