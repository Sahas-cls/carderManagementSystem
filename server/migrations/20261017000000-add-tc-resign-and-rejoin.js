"use strict";
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  // Training Center "Resigned" now records each trainee who left (exit type
  // tc_resign, kept separate from production's Resigned/Terminated), and the
  // Training Center gets its own Rejoined count for trainees who come back.
  async up(queryInterface, Sequelize) {
    // The TC transfer categories are transfer reasons - keep them out of the
    // Resigned/Terminated reason dropdowns (the first version of the previous
    // migration seeded them unflagged).
    await queryInterface.sequelize.query(
      "UPDATE resignationreasons SET transferRelated = true WHERE resignedReason IN (?, ?, ?)",
      { replacements: ["To Prod as MO", "To Prod as TMO", "External Transfer"] },
    );
    await queryInterface.changeColumn("employeeexits", "type", {
      type: Sequelize.ENUM("resign", "transfer", "tc_transfer", "tc_resign"),
      allowNull: false,
    });
    await queryInterface.addColumn("trainingcenters", "rejoined", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("trainingcenters", "rejoined");
    await queryInterface.bulkDelete("employeeexits", { type: "tc_resign" });
    await queryInterface.changeColumn("employeeexits", "type", {
      type: Sequelize.ENUM("resign", "transfer", "tc_transfer"),
      allowNull: false,
    });
  },
};
