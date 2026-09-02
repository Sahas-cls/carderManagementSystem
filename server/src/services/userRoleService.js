"use strict";

const { UserRole } = require("../../models");

/** Every user role, for the admin "edit user" role dropdown. */
async function getAllUserRoles() {
  return UserRole.findAll({
    attributes: ["roleId", "userRole"],
    order: [["userRole", "ASC"]],
  });
}

module.exports = { getAllUserRoles };
