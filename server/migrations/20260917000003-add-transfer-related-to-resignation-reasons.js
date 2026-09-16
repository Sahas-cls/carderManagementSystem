"use strict";
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  // Lets a reason be flagged as belonging to the Transfer tile (see
  // ResignedEmployeesModal.jsx) so its "Reason for Transfer" dropdown only
  // offers reasons meant for a transfer, instead of every reason including
  // ones meant for an actual resignation/termination.
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("resignationreasons", "transferRelated", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    // The two reasons seeded for the Transfer tile (see
    // 20260917000002-seed-transfer-resignation-reasons.js) are transfer
    // reasons by definition - flip them on now that the column exists.
    await queryInterface.sequelize.query(
      "UPDATE resignationreasons SET transferRelated = true WHERE resignedReason IN (?, ?)",
      { replacements: ["Internal Transfer", "External Transfer"] },
    );
  },
  async down(queryInterface) {
    await queryInterface.removeColumn("resignationreasons", "transferRelated");
  },
};
