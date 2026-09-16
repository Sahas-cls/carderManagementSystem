"use strict";
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Only meaningful for a Transfer-tile row (isTransfer: true) - the
    // designation they're moving into (e.g. TMO -> MO on an internal
    // promotion, or their new role wherever they're transferring to).
    // `designationId` keeps meaning their designation before the transfer,
    // same as it does for every other exit-tile row. Null otherwise.
    await queryInterface.addColumn("employees", "newDesignationId", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: "designations",
        key: "id",
      },
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn("employees", "newDesignationId");
  },
};
