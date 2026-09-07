'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Links an Employee row to the Daily Data Entry batch that recorded their
    // resignation (batchId is a plain UUID shared across every carder table
    // for one entry - see server/src/services/dailyCadreService.js - not a
    // real FK since no single table owns it). Null for an employee who isn't
    // tied to a specific daily entry (e.g. unlinked after that entry was
    // deleted or their count was reduced on edit).
    await queryInterface.addColumn('employees', 'batchId', {
      type: Sequelize.UUID,
      allowNull: true,
    });
    // Whether this employee was counted against the Resigned/Terminated MO
    // count (true) or the TMO count (false) on that daily entry. Null when
    // batchId is null.
    await queryInterface.addColumn('employees', 'isMo', {
      type: Sequelize.BOOLEAN,
      allowNull: true,
    });
    await queryInterface.addIndex('employees', ['batchId']);
  },
  async down(queryInterface) {
    await queryInterface.removeIndex('employees', ['batchId']);
    await queryInterface.removeColumn('employees', 'isMo');
    await queryInterface.removeColumn('employees', 'batchId');
  },
};
