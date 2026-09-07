'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // PlannedCarders used to copy Budget Master's moCount/tmoCount into every
    // single daily entry row, which duplicated master data and (until a
    // recent fix) let the client forge what got stored. Replacing MO/TMO/total
    // with a budgetId FK removes the duplication - Planned MO/TMO is now
    // resolved by joining Budgets at read time (see dailyCadreService.js).
    await queryInterface.addColumn('plannedcarders', 'budgetId', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'budgets',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });

    // Backfill: match each existing row to the Budget it was actually copied
    // from (same factory, same moCount/tmoCount), preferring the most
    // recently created match if more than one Budget row ties. A row with no
    // matching Budget (e.g. the budget was later edited or deleted) is left
    // with budgetId NULL rather than guessed at.
    await queryInterface.sequelize.query(`
      UPDATE plannedcarders pc
      SET pc.budgetId = (
        SELECT b.id FROM budgets b
        WHERE b.factoryId = pc.factoryId
          AND b.moCount = pc.MO
          AND b.tmoCount = pc.TMO
        ORDER BY b.id DESC
        LIMIT 1
      )
    `);

    await queryInterface.removeColumn('plannedcarders', 'MO');
    await queryInterface.removeColumn('plannedcarders', 'TMO');
    await queryInterface.removeColumn('plannedcarders', 'total');
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn('plannedcarders', 'MO', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });
    await queryInterface.addColumn('plannedcarders', 'TMO', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });
    await queryInterface.addColumn('plannedcarders', 'total', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });

    // Best-effort restore from whichever Budget each row pointed to; rows
    // with no budgetId (no matching Budget was found on the way up) stay 0.
    await queryInterface.sequelize.query(`
      UPDATE plannedcarders pc
      JOIN budgets b ON b.id = pc.budgetId
      SET pc.MO = b.moCount, pc.TMO = b.tmoCount, pc.total = b.moCount + b.tmoCount
    `);

    await queryInterface.removeColumn('plannedcarders', 'budgetId');
  }
};
