'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('employees', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      epf: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      employeeName: {
        type: Sequelize.STRING,
        allowNull: false
      },
      designationId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'designations',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      departmentId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'departments',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      sectionId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'sections',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      dateOfJoin: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      dateOfResign: {
        type: Sequelize.DATEONLY,
        allowNull: true
      },
      resignationReasonId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'resignationreasons',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      deletedAt: {
        allowNull: true,
        type: Sequelize.DATE
      }
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('employees');
  }
};
