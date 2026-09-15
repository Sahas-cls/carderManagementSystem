"use strict";
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Only meaningful for a Transfer-tile row that was originally TMO
    // (isTransfer: true, isMo: false) - distinguishes the two ways a
    // transfer actually plays out:
    //   - true:  an internal promotion - they stay in this carder,
    //     reclassified from TMO to MO (Allocated_Current MO +1, TMO -1).
    //   - false (or an originally-MO transfer row, where this is ignored):
    //     they leave this carder entirely, e.g. transferred to another
    //     factory/department (Allocated_Current -1 for their own type).
    // Null while not applicable (not a transfer row, or batchId is null).
    await queryInterface.addColumn("employees", "promotedToMo", {
      type: Sequelize.BOOLEAN,
      allowNull: true,
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn("employees", "promotedToMo");
  },
};
