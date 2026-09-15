"use strict";
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Splits the old combined "Resigned/Terminated" exit reason into two
    // buckets: a true resignation/termination (isTransfer: false) vs a
    // transfer out of this cadre - e.g. a promotion that moves the employee
    // off the MO/TMO carder entirely (isTransfer: true). Null while the
    // employee isn't currently linked to a daily entry (batchId is null),
    // same lifecycle as isMo - see 20260906000000-add-batch-ismo-to-employees.js.
    await queryInterface.addColumn("employees", "isTransfer", {
      type: Sequelize.BOOLEAN,
      allowNull: true,
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn("employees", "isTransfer");
  },
};
