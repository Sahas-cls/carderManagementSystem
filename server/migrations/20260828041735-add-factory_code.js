"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("Factories", "factoryCode", {
      type: Sequelize.DataTypes.STRING,
      allowNull: false,
    });   
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("Factories", "factoryCode");
  },
};
