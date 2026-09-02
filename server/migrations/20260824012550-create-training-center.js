'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('TrainingCenters', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      planned: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      allocated: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      recruit: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      resigned: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      transferToProLine: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      actualAllocated: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      absent: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      present: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('TrainingCenters');
  }
};
