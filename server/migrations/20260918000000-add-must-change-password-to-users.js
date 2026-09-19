"use strict";
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Set true by an admin-initiated password reset (see userService.resetPassword)
    // so the account is forced through /auth/change-password before it can use
    // anything else - see the requireAuth gate in server/src/middleware/auth.js.
    await queryInterface.addColumn("users", "mustChangePassword", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn("users", "mustChangePassword");
  },
};
