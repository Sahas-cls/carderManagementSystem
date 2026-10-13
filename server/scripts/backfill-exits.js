"use strict";
/**
 * Backfills employeeexits from the exit fields currently on employees.
 * Insert-only and idempotent - never updates or deletes employees. Dry run
 * by default; pass --apply to write.
 *
 *   node server/scripts/backfill-exits.js          # dry run
 *   node server/scripts/backfill-exits.js --apply
 *
 * employees only holds each person's LATEST exit, so at most one event per
 * employee is created; earlier events overwritten in the past can't be
 * recovered. Rows with no batch (or no isTransfer flag) are inserted with
 * needsReview = true.
 */
const { Op } = require("sequelize");
const { Employee, EmployeeExit, sequelize } = require("../models");

async function main() {
  const apply = process.argv.includes("--apply");
  const employees = await Employee.findAll({
    where: { dateOfResign: { [Op.ne]: null } },
    paranoid: false,
  });

  const stats = { toInsert: 0, existing: 0, review: 0 };
  const transaction = await sequelize.transaction();
  try {
    for (const e of employees) {
      const type = e.isTransfer ? "transfer" : "resign";
      const where = { employeeId: e.id, type, batchId: e.batchId ?? null };
      if (await EmployeeExit.findOne({ where, transaction })) {
        stats.existing += 1;
        continue;
      }
      const needsReview = !e.batchId || e.isTransfer === null || e.isTransfer === undefined;
      if (needsReview) stats.review += 1;
      stats.toInsert += 1;
      if (apply) {
        await EmployeeExit.create(
          {
            ...where,
            isMo: e.isMo ?? null,
            dateOfExit: e.dateOfResign,
            resignationReasonId: e.resignationReasonId ?? null,
            newDesignationId: e.newDesignationId ?? null,
            promotedToMo: e.promotedToMo ?? null,
            dateOfRejoin: e.dateOfRejoin ?? null,
            rejoinedBatchId: e.rejoinedBatchId ?? null,
            rejoinedIsMo: e.rejoinedIsMo ?? null,
            needsReview,
          },
          { transaction },
        );
      }
    }
    if (apply) await transaction.commit();
    else await transaction.rollback();
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
  console.log(`${apply ? "APPLIED" : "DRY RUN"}: employees with an exit=${employees.length}, inserted=${stats.toInsert}, already present=${stats.existing}, flagged for review=${stats.review}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => sequelize.close());
