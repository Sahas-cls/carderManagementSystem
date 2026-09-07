'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('trainingcenters', 'weekId', {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: 'weeks',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT'
    });
    await queryInterface.addColumn('trainingcenters', 'factoryId', {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: 'factories',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT'
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('trainingcenters', 'factoryId');
    await queryInterface.removeColumn('trainingcenters', 'weekId');
  }
};
