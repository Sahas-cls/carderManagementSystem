'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('TrainingCenters', 'weekId', {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: 'Weeks',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT'
    });
    await queryInterface.addColumn('TrainingCenters', 'factoryId', {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: 'Factories',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT'
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('TrainingCenters', 'factoryId');
    await queryInterface.removeColumn('TrainingCenters', 'weekId');
  }
};
