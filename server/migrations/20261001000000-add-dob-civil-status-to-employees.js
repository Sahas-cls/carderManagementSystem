"use strict";
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("employees", "dateOfBirth", {
      type: Sequelize.DATEONLY,
      allowNull: true,
    });
    // Plain string ("Married" / "Unmarried"), deliberately not an ENUM.
    await queryInterface.addColumn("employees", "civilStatus", {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn("employees", "civilStatus");
    await queryInterface.removeColumn("employees", "dateOfBirth");
  },
};
