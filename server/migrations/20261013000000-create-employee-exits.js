"use strict";
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // One row per exit EVENT (resignation/termination or transfer), so a
    // single employee can hold several - e.g. a transfer on one daily entry
    // and a resignation on another - instead of the single batchId/
    // dateOfResign pair on employees. Additive: nothing existing reads or
    // writes this table yet (see server/scripts/backfill-exits.js).
    await queryInterface.createTable("employeeexits", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      employeeId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "employees", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      // Plain UUID shared across every carder table for one daily entry, not a
      // real FK - same as employees.batchId. Null when not tied to an entry.
      batchId: {
        type: Sequelize.UUID,
        allowNull: true,
      },
      type: {
        type: Sequelize.ENUM("resign", "transfer"),
        allowNull: false,
      },
      // true = counted against that entry's MO count, false = TMO.
      isMo: {
        type: Sequelize.BOOLEAN,
        allowNull: true,
      },
      dateOfExit: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      resignationReasonId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "resignationreasons", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      newDesignationId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "designations", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      promotedToMo: {
        type: Sequelize.BOOLEAN,
        allowNull: true,
      },
      dateOfRejoin: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      rejoinedBatchId: {
        type: Sequelize.UUID,
        allowNull: true,
      },
      rejoinedIsMo: {
        type: Sequelize.BOOLEAN,
        allowNull: true,
      },
      // Set by the backfill for rows that couldn't be tied to a batch
      // confidently, so they can be reviewed by hand.
      needsReview: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE },
    });
    await queryInterface.addIndex("employeeexits", ["employeeId"]);
    await queryInterface.addIndex("employeeexits", ["batchId"]);
    await queryInterface.addIndex("employeeexits", ["employeeId", "type", "dateOfExit"]);
  },
  async down(queryInterface) {
    await queryInterface.dropTable("employeeexits");
  },
};
