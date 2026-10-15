"use strict";
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Append-only history of every change to an exit event (employeeexits), so
    // an exit that goes missing from a daily entry can be traced and restored.
    // Deliberately no foreign keys: rows must outlive the employee/exit they
    // describe (hard deletes cascade employeeexits away).
    await queryInterface.createTable("exitlogs", {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
      action: { type: Sequelize.STRING(40), allowNull: false },
      exitId: { type: Sequelize.INTEGER, allowNull: true },
      employeeId: { type: Sequelize.INTEGER, allowNull: true },
      epf: { type: Sequelize.STRING, allowNull: true },
      employeeName: { type: Sequelize.STRING, allowNull: true },
      batchId: { type: Sequelize.UUID, allowNull: true },
      // Full copy of the exit event (and employee, for deletes) as it stood.
      snapshot: { type: Sequelize.JSON, allowNull: true },
      createdAt: { allowNull: false, type: Sequelize.DATE },
    });
    await queryInterface.addIndex("exitlogs", ["epf"]);
    await queryInterface.addIndex("exitlogs", ["batchId"]);
    await queryInterface.addIndex("exitlogs", ["employeeId"]);
  },
  async down(queryInterface) {
    await queryInterface.dropTable("exitlogs");
  },
};
