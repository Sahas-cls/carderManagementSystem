"use strict";
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  // Lets a Daily Data Entry record's Rejoined MO/TMO count be traced back to
  // the actual employee(s) it came from (the "view rejoined employees" eye
  // icon), the same way resignedBatchId/isMo already does for the Resigned/
  // Transfer tiles - see server/src/services/dailyCadreService.js.
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("employees", "rejoinedBatchId", {
      type: Sequelize.UUID,
      allowNull: true,
    });
    await queryInterface.addColumn("employees", "rejoinedIsMo", {
      type: Sequelize.BOOLEAN,
      allowNull: true,
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn("employees", "rejoinedBatchId");
    await queryInterface.removeColumn("employees", "rejoinedIsMo");
  },
};
