"use strict";

// Every carder table listed here is confirmed empty at the time this was
// written, so these are safe straight NOT NULL adds - no backfill needed.

const TABLES_MISSING_DATE = [
  "plannedcarders",
  "allocatedactualcarders",
  "shortagecarders",
  "allocatedcurrentcarders",
  "absenteeismcarders",
  "presentcarders",
  "trainingcenters",
];

const ALL_CARDER_TABLES = [
  "plannedcarders",
  "allocatedactualcarders",
  "shortagecarders",
  "newrecruitcarders",
  "resignedcarders",
  "netcarders",
  "allocatedcurrentcarders",
  "absenteeismcarders",
  "presentcarders",
  "trainingcenters",
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    for (const table of TABLES_MISSING_DATE) {
      await queryInterface.addColumn(table, "date", {
        type: Sequelize.DATEONLY,
        allowNull: false,
      });
    }

    // batchId ties one Daily Data Entry submission's rows together across
    // all 10 tables (there's no per-date/per-factory uniqueness - a factory
    // can have several entries for the same day - so this is the only way
    // to regroup a submission back into one record for display/edit/delete).
    for (const table of ALL_CARDER_TABLES) {
      await queryInterface.addColumn(table, "batchId", {
        type: Sequelize.UUID,
        allowNull: false,
      });
      await queryInterface.addIndex(table, ["batchId"]);
    }
  },

  async down(queryInterface) {
    for (const table of ALL_CARDER_TABLES) {
      await queryInterface.removeIndex(table, ["batchId"]);
      await queryInterface.removeColumn(table, "batchId");
    }
    for (const table of TABLES_MISSING_DATE) {
      await queryInterface.removeColumn(table, "date");
    }
  },
};
