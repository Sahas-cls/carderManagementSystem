"use strict";

const crypto = require("crypto");
const { User, UserRole, Factory } = require("../../models");
const ApiError = require("../utils/ApiError");
const { hashPassword } = require("../utils/password");

const FACTORY_INCLUDE = { model: Factory, as: "factory", attributes: ["id", "factoryName"] };

/** Lists every user with their role and assigned factory, newest first - for the admin "Manage Users" screen. */
async function listUsers() {
  return User.findAll({
    include: [{ model: UserRole, as: "role", attributes: ["roleId", "userRole"] }, FACTORY_INCLUDE],
    order: [["createdAt", "DESC"]],
  });
}

async function getUserOr404(id) {
  const user = await User.findByPk(id, { include: [{ model: UserRole, as: "role" }, FACTORY_INCLUDE] });
  if (!user) {
    throw new ApiError(404, `User ${id} not found.`);
  }
  return user;
}

/** Edits a user's profile fields (any subset of userName/email/userRole/factoryId). */
async function updateUser(id, { userName, email, userRole, factoryId }, actingUserId) {
  const user = await getUserOr404(id);

  if (email && email !== user.email) {
    const existing = await User.findOne({ where: { email } });
    if (existing && existing.id !== user.id) {
      throw new ApiError(409, "An account with this email already exists.");
    }
  }

  if (userRole !== undefined && userRole !== user.userRole) {
    const role = await UserRole.findByPk(userRole);
    if (!role) {
      throw new ApiError(400, `Role ${userRole} does not exist.`);
    }
    if (Number(id) === actingUserId && role.userRole !== "Administrator") {
      throw new ApiError(400, "You can't remove your own Administrator role.");
    }
  }

  if (factoryId !== undefined && factoryId !== null && factoryId !== user.factoryId) {
    const factory = await Factory.findByPk(factoryId);
    if (!factory) {
      throw new ApiError(400, `Factory ${factoryId} does not exist.`);
    }
  }

  await user.update({
    ...(userName !== undefined ? { userName } : {}),
    ...(email !== undefined ? { email } : {}),
    ...(userRole !== undefined ? { userRole } : {}),
    ...(factoryId !== undefined ? { factoryId } : {}),
  });

  return getUserOr404(id);
}

/** Activates or deactivates an account. An admin can't deactivate their own account (avoids locking everyone out). */
async function setActiveStatus(id, isActive, actingUserId) {
  const user = await getUserOr404(id);

  if (Number(id) === actingUserId && !isActive) {
    throw new ApiError(400, "You can't deactivate your own account.");
  }

  await user.update({ isActive });
  return user;
}

/**
 * Admin-initiated password reset: generates a new random password, saves its
 * hash, and returns the plaintext once so the admin can relay it to the user
 * (there's no outbound email in this app yet).
 */
async function resetPassword(id) {
  const user = await getUserOr404(id);
  const tempPassword = crypto.randomBytes(9).toString("base64url");
  user.password = await hashPassword(tempPassword);
  await user.save();
  return { user, tempPassword };
}

/**
 * Permanently deletes a user account. An admin can't delete their own
 * account (same reasoning as setActiveStatus not allowing self-deactivation
 * - avoids locking everyone, including yourself, out mid-session). Safe at
 * the DB level: every table with a createdBy FK to users (Factory, Week,
 * Budget, TCBudget) sets it to NULL on delete rather than blocking it or
 * cascading - see their migrations - so this never takes other records with
 * it, it just detaches "created by" attribution.
 */
async function deleteUser(id, actingUserId) {
  const user = await getUserOr404(id);

  if (Number(id) === actingUserId) {
    throw new ApiError(400, "You can't delete your own account.");
  }

  await user.destroy();
}

module.exports = { listUsers, updateUser, setActiveStatus, resetPassword, deleteUser };
