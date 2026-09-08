'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // TrainingCenter used to take Planned straight from the user's typed
    // input, which let the client forge what got stored - the same issue
    // Planned MO/TMO had before it was moved onto Budget Master (see
    // 20260902010000-planned-carder-use-budget-fk.js). Replacing the
    // `planned` column with a tcBudgetId FK fixes it the same way - Training
    // Center's Planned is now resolved by joining TCBudgets at read time
    // (see dailyCadreService.js).
    await queryInterface.addColumn('trainingcenters', 'tcBudgetId', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'tcbudgets',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });

    // Backfill: match each existing row to the TCBudget it was actually
    // copied from (same factory, same planned value), preferring the most
    // recently created match if more than one TCBudget row ties. A row with
    // no matching TCBudget (none configured yet, or it was later edited) is
    // left with tcBudgetId NULL rather than guessed at.
    await queryInterface.sequelize.query(`
      UPDATE trainingcenters tc
      SET tc.tcBudgetId = (
        SELECT b.id FROM tcbudgets b
        WHERE b.factoryId = tc.factoryId
          AND b.planned = tc.planned
        ORDER BY b.id DESC
        LIMIT 1
      )
    `);

    await queryInterface.removeColumn('trainingcenters', 'planned');
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn('trainingcenters', 'planned', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });

    // Best-effort restore from whichever TCBudget each row pointed to; rows
    // with no tcBudgetId (no matching TCBudget was found on the way up)
    // stay 0.
    await queryInterface.sequelize.query(`
      UPDATE trainingcenters tc
      JOIN tcbudgets b ON b.id = tc.tcBudgetId
      SET tc.planned = b.planned
    `);

    await queryInterface.removeColumn('trainingcenters', 'tcBudgetId');
  }
};
