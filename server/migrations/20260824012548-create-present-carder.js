'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('presentcarders', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      MO: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      TMO: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      total: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      weekId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'weeks',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      factoryId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'factories',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
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
    await queryInterface.dropTable('presentcarders');
  }
};
