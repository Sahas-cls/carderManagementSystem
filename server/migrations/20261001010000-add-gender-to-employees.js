"use strict";
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Plain string ("Male" / "Female"), deliberately not an ENUM - same as civilStatus.
    await queryInterface.addColumn("employees", "gender", {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn("employees", "gender");
  },
};
