'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Drop the old string column and add it back as an integer FK to UserRoles.
    // (A straight changeColumn type change isn't safe here since existing
    // values are role names, not ids.)
    await queryInterface.removeColumn('users', 'userRole');
    await queryInterface.addColumn('users', 'userRole', {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: 'userroles',
        key: 'roleId'
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT'
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('users', 'userRole');
    await queryInterface.addColumn('users', 'userRole', {
      type: Sequelize.STRING,
      allowNull: false
    });
  }
};
