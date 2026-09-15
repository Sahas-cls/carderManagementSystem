"use strict";
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  // transferMO/transferTMO used to persist how "Transfer to Pro Line" split
  // between MO/TMO so it could be backed out of the (now-removed) combined
  // New Recr./Rejoined/Released MO/TMO field on reload. That field is split
  // into its own separate tiles/tables now (see releasedfromtccarders /
  // rejoinedcarders), so this split lives in releasedfromtccarders'
  // MO/TMO columns instead and these columns are dead weight.
  async up(queryInterface) {
    await queryInterface.removeColumn("trainingcenters", "transferTMO");
    await queryInterface.removeColumn("trainingcenters", "transferMO");
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn("trainingcenters", "transferMO", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });
    await queryInterface.addColumn("trainingcenters", "transferTMO", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });
  },
};
