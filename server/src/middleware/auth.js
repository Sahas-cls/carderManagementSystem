"use strict";

const { User, UserRole, Factory } = require("../../models"); // imports models
const ApiError = require("../utils/ApiError"); // error gen
const asyncHandler = require("../utils/asyncHandler"); //
const { verifyToken } = require("../utils/token"); // token verifier

/** Requires a valid `Authorization: Bearer <token>` header; attaches the current user (with role) as req.user. */
const requireAuth = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || "";
  // console.log("header: ", header);
  const [scheme, token] = header.split(" ");
  console.log(`scheme ${scheme} token ${token}`);
  // return;
  if (scheme !== "Bearer" || !token) {
    throw new ApiError(401, "Authentication required.");
  }

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    throw new ApiError(401, "Invalid or expired session. Please log in again.");
  }
  console.log("payLoad: ", payload);
  // return;
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
  // console.log("allowed: ", allowed);
  // return;
  return (req, res, next) => {
    const roleName = req.user?.role?.userRole;
    if (!roleName || !allowed.has(roleName.toLowerCase())) {
      return next(new ApiError(403, "You don't have permission to do that."));
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
