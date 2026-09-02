'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Persists how the "Transfer to Pro Line" count currently splits between MO
    // and TMO, so the client can recover the exact split (and the resulting
    // "base" New Recr. MO/TMO before the transfer was applied) after a page
    // refresh instead of losing it to in-memory-only state.
    await queryInterface.addColumn('TrainingCenters', 'transferMO', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });
    await queryInterface.addColumn('TrainingCenters', 'transferTMO', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('TrainingCenters', 'transferTMO');
    await queryInterface.removeColumn('TrainingCenters', 'transferMO');
  }
};
