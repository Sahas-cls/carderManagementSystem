"use strict";

const { Op } = require("sequelize");
const {
  Employee,
  EmployeeExit,
  ExitLog,
  Designation,
  Department,
  Section,
  ManageServiceRanges,
  ResignationReason,
  ResignedCarder,
  PlannedCarder,
  Factory,
} = require("../../models");
const ApiError = require("../utils/ApiError");

const exitType = (isTransfer) => (isTransfer ? "transfer" : "resign");

/**
 * Appends to the exit audit trail (exitlogs). Call it BEFORE the change with
 * the event as it currently stands, passing what's about to change as
 * `changes`, so the log keeps what was lost - or right after a create. Runs in
 * the caller's transaction, so a rolled-back save leaves no log either.
 */
async function logExit(action, exit, transaction, changes) {
  const employee =
    exit.employee || (await Employee.findByPk(exit.employeeId, { paranoid: false, transaction }));
  const plain = exit.get({ plain: true });
  delete plain.employee;
  delete plain.resignationReason;
  await ExitLog.create(
    {
      action,
      exitId: exit.id,
      employeeId: exit.employeeId,
      epf: employee?.epf ?? null,
      employeeName: employee?.employeeName ?? null,
      batchId: exit.batchId,
      snapshot: { exit: plain, ...(changes ? { changes } : {}) },
    },
    { transaction },
  );
}

/** Logs then applies `values` to each of the given exit events. */
async function updateExitsLogged(action, exits, values, transaction) {
  for (const ev of exits) await logExit(action, ev, transaction, values);
  await EmployeeExit.update(values, { where: { id: { [Op.in]: exits.map((ev) => ev.id) } }, transaction });
}

/** Logs then deletes every exit event of one employee. */
async function destroyExitsLogged(employeeId, action, transaction) {
  const exits = await EmployeeExit.findAll({ where: { employeeId }, transaction });
  for (const ev of exits) await logExit(action, ev, transaction);
  if (exits.length) await EmployeeExit.destroy({ where: { employeeId }, transaction });
}

/**
 * An employee's exit events that are still standing (not rejoined), newest
 * exit first. Several can be active at once - e.g. a transfer on one daily
 * entry and a later resignation on another - which is exactly what the single
 * batchId/dateOfResign pair on Employee could not express.
 */
function findActiveExits(employeeId, transaction) {
  return EmployeeExit.findAll({
    where: { employeeId, rejoinedBatchId: null },
    order: [
      ["dateOfExit", "DESC"],
      ["id", "DESC"],
    ],
    transaction,
  });
}

/**
 * Keeps the legacy exit columns on Employee (batchId, isMo, isTransfer,
 * promotedToMo, dateOfResign, resignationReasonId, newDesignationId and the
 * rejoin fields) in step with the exit events, as a summary of the CURRENT
 * exit - the latest active event. Manage Employees, the unlinked-employees
 * list and the like still read those columns; employeeexits is the source of
 * truth and this is derived from it after every event change.
 *   - active event, linked to an entry: that event's details.
 *   - active event whose entry link was trimmed/deleted (batchId null): the
 *     exit stays on file but isMo/isTransfer/promotedToMo are cleared, same as
 *     the old "unlinked" state.
 *   - no active event but a rejoined one: the active-employee state, with the
 *     latest rejoin recorded.
 *   - no events at all: left alone (e.g. a Date of Resign typed straight into
 *     Manage Employees).
 */
async function refreshLegacyExit(employeeId, transaction) {
  const employee = await Employee.findByPk(employeeId, { transaction });
  if (!employee) return;
  const [current] = await findActiveExits(employeeId, transaction);
  if (current) {
    const linked = !!current.batchId;
    const isTransfer = current.type === "transfer";
    await employee.update(
      {
        dateOfResign: current.dateOfExit,
        resignationReasonId: current.resignationReasonId,
        newDesignationId: current.newDesignationId,
        batchId: current.batchId,
        isMo: linked ? current.isMo : null,
        isTransfer: linked ? isTransfer : null,
        promotedToMo: linked && isTransfer ? current.promotedToMo : null,
        rejoinedBatchId: null,
        rejoinedIsMo: null,
      },
      { transaction },
    );
    return;
  }
  const rejoined = await EmployeeExit.findOne({
    where: { employeeId, rejoinedBatchId: { [Op.ne]: null } },
    order: [
      ["updatedAt", "DESC"],
      ["id", "DESC"],
    ],
    transaction,
  });
  if (!rejoined) return;
  await employee.update(
    {
      dateOfResign: null,
      resignationReasonId: null,
      newDesignationId: null,
      batchId: null,
      isMo: null,
      isTransfer: null,
      promotedToMo: null,
      dateOfRejoin: rejoined.dateOfRejoin,
      rejoinedBatchId: rejoined.rejoinedBatchId,
      rejoinedIsMo: rejoined.rejoinedIsMo,
    },
    { transaction },
  );
}

/** " on the <factory> daily entry dated <date>" for the 409 messages below. */
async function describeBatch(batchId, transaction) {
  const other = await PlannedCarder.findOne({
    where: { batchId },
    include: [{ model: Factory, as: "factory", attributes: ["factoryName"] }],
    transaction,
  });
  return other
    ? ` on the ${other.factory?.factoryName ? `${other.factory.factoryName} ` : ""}daily entry dated ${other.date}`
    : " on another daily entry";
}

/**
 * Refuses an exit that can't make sense next to the employee's other active
 * exits (orphaned ones - batchId null, not on any entry - don't count):
 *   - a resignation/termination ends the road: nothing else can be recorded
 *     for them on a different entry until they're rejoined. This is also what
 *     catches the same EPF being entered twice by mistake.
 *   - after a transfer, a later resignation is fine (the case this table
 *     exists for) and so is a later transfer (e.g. a second promotion), but
 *     each must be dated after the transfer it follows - an earlier or
 *     same-day one on a different entry is a duplicate or a typo.
 *   - the same employee can't sit on one entry as both a transfer and a
 *     resignation: the per-employee Delete/Rejoin routes only know (batch, epf).
 */
async function assertCanRecordExit(employee, batchId, isTransfer, dateOfExit, transaction) {
  const type = exitType(isTransfer);
  const active = await findActiveExits(employee.id, transaction);
  // Re-saving an entry resubmits the exits it already holds - e.g. fixing a
  // count on the older entry after the employee has since resigned on a later
  // one. That's not a new exit, so there's nothing to validate.
  if (active.some((ev) => ev.batchId === batchId && ev.type === type)) return;
  for (const ev of active) {
    if (!ev.batchId) continue;
    if (ev.batchId === batchId) {
      if (ev.type !== type) {
        throw new ApiError(
          409,
          `EPF ${employee.epf} (${employee.employeeName}) is already on this daily entry as ${
            ev.type === "transfer" ? "transferred" : "resigned"
          }. Remove them from that tile first.`,
        );
      }
      continue;
    }
    const evIsResign = ev.type === "resign";
    // Same EPF resigned twice, or a transfer/second exit dated on or after a
    // resignation (they'd already left), or a resignation dated on or before
    // a transfer it supposedly follows, or the same transfer entered twice.
    const conflict = evIsResign
      ? !isTransfer || dateOfExit >= ev.dateOfExit
      : isTransfer
        ? dateOfExit === ev.dateOfExit
        : dateOfExit <= ev.dateOfExit;
    if (!conflict) continue;
    const where = await describeBatch(ev.batchId, transaction);
    const what = evIsResign ? "resigned" : "transferred";
    const hint = evIsResign
      ? "Remove them from that entry first (or rejoin them), or check the EPF No."
      : "A resignation must be dated after a transfer it follows, and the same transfer can't be entered twice - check the date and EPF No., or remove them from that entry first.";
    throw new ApiError(
      409,
      `EPF ${employee.epf} (${employee.employeeName}) is already recorded as ${what}${where} (${ev.dateOfExit}). ${hint}`,
    );
  }
}

/**
 * Upserts the exit event for one employee on one entry. Re-saving the same
 * entry updates its standing event; one a previous save orphaned (batchId
 * null) is relinked rather than a second created. Runs inside the caller's
 * transaction, so a failure rolls the whole save back.
 */
async function recordExit(employeeId, batchId, isTransfer, fields, transaction) {
  const type = exitType(isTransfer);
  const values = {
    batchId,
    type,
    isMo: fields.isMo ?? null,
    dateOfExit: fields.dateOfResign,
    resignationReasonId: fields.resignationReasonId ?? null,
    newDesignationId: fields.newDesignationId ?? null,
    promotedToMo: fields.promotedToMo ?? null,
    needsReview: false,
  };
  const standing = { employeeId, type, rejoinedBatchId: null };
  const active =
    (await EmployeeExit.findOne({ where: { ...standing, batchId }, order: [["id", "DESC"]], transaction })) ||
    (await EmployeeExit.findOne({ where: { ...standing, batchId: null }, order: [["id", "DESC"]], transaction }));
  if (active) {
    await logExit("updated", active, transaction, values);
    await active.update(values, { transaction });
  } else {
    const created = await EmployeeExit.create({ employeeId, ...values }, { transaction });
    await logExit("created", created, transaction);
  }
}

/**
 * Creates/updates the Employee rows for the Resigned/Transfer Employee popup
 * on the Daily Data Entry form (see CadreDetailsCard.jsx's
 * ResignedEmployeesModal) and records each one's exit event against this
 * daily entry's batch.
 * `isTransfer` tags which of the two tiles this call is syncing for (false =
 * Resigned/Terminated, true = Transfer) - dailyCadreService.performUpdate
 * calls this once per tile for the same batch, so the trim step below is
 * scoped to events of that same type only: an employee of the OTHER type still
 * on this batch must not be touched by this call.
 *
 * `epf` is upserted rather than always inserted: epf is unique on Employee,
 * and re-saving the same daily entry (edit) resubmits the same rows, so an
 * insert-only approach would collide on epf. Any employee of this type
 * previously on this batch but no longer present in `employees` is
 * detached from it (the event's batchId cleared) rather than deleted - the
 * employee record itself is real master data (their exit happened), only
 * its tie to this particular entry is undone.
 *
 * An employee may already have exits on OTHER entries - see
 * assertCanRecordExit for what's allowed.
 */
async function syncResignedEmployees(employees, batchId, transaction, isTransfer = false) {
  const list = Array.isArray(employees) ? employees : [];
  const touched = new Set();

  for (const emp of list) {
    const exitFields = {
      newDesignationId: isTransfer ? emp.newDesignationId ?? null : null,
      dateOfResign: emp.dateOfResign,
      resignationReasonId: emp.resignationReasonId ?? null,
      isMo: emp.isMo,
      // Only meaningful for a Transfer-tile row (isTransfer: true) that was
      // originally TMO - whether they're staying (promoted to MO) or
      // leaving. Ignored/null for Resigned/Terminated rows.
      promotedToMo: isTransfer ? !!emp.promotedToMo : null,
    };
    const fields = {
      employeeName: emp.employeeName,
      designationId: emp.designationId,
      departmentId: emp.departmentId,
      sectionId: emp.sectionId,
    };
    // Transfer doesn't collect Date of Joining (see ResignedEmployeesModal) -
    // leave a real existing employee's join date alone rather than having it
    // silently overwritten; only a genuinely new employee needs one at all,
    // defaulted to their transfer's effective date.
    if (!isTransfer) fields.dateOfJoin = emp.dateOfJoin;
    // Only collected on the Resigned/Terminated popup - leave whatever's on
    // file alone for a Transfer row.
    if (!isTransfer) {
      fields.dateOfBirth = emp.dateOfBirth ?? null;
      fields.civilStatus = emp.civilStatus ?? null;
    }

    // paranoid:false - epf stays unique across soft-deleted rows too (e.g. a
    // cleaned-up unlinked employee), so a returning epf must revive that row
    // rather than insert a second one and hit the unique index.
    const existing = await Employee.findOne({ where: { epf: emp.epf }, paranoid: false, transaction });
    if (existing && !existing.deletedAt) {
      await assertCanRecordExit(existing, batchId, isTransfer, emp.dateOfResign, transaction);
    }
    let employee;
    if (existing) {
      if (existing.deletedAt) {
        await existing.restore({ transaction });
        // Whatever exits it carried belong to the record that was cleaned up.
        await destroyExitsLogged(existing.id, "purged_on_restore", transaction);
      }
      employee = await existing.update(fields, { transaction });
    } else {
      employee = await Employee.create(
        { epf: emp.epf, dateOfJoin: isTransfer ? emp.dateOfResign : emp.dateOfJoin, ...fields },
        { transaction },
      );
    }
    await recordExit(employee.id, batchId, isTransfer, exitFields, transaction);
    touched.add(employee.id);
  }

  const currentEpfs = list.map((emp) => emp.epf);
  const employeeWhere = currentEpfs.length ? { epf: { [Op.notIn]: currentEpfs } } : undefined;
  const trimmed = await findExits(
    { batchId, type: exitType(isTransfer), rejoinedBatchId: null },
    { transaction, employeeWhere },
  );
  if (trimmed.length) {
    await updateExitsLogged("unlinked_trimmed", trimmed, { batchId: null }, transaction);
    trimmed.forEach((ev) => touched.add(ev.employeeId));
  }

  for (const employeeId of touched) await refreshLegacyExit(employeeId, transaction);
}

/**
 * Removes one resigned/transferred employee from an entry - backs the
 * per-employee Delete button in ResignedEmployeesModal.jsx. Scoped to the
 * batch the employee is currently on, so a stray epf can't delete unrelated
 * master data via this route. An employee with no other exit history is
 * hard-deleted outright, as before (their events go with them via the FK
 * cascade); one who also has other exits (e.g. an earlier transfer) keeps
 * their record and only loses this event. Returns the removed event's isMo
 * (true = MO, false = TMO) and isTransfer (true = Transfer tile, false =
 * Resigned/Terminated tile) so the caller can decrement the right tile's
 * count; throws 404 if that epf isn't currently on this batch (e.g. it was
 * only added to the form this session and never actually saved yet).
 */
async function deleteResignedEmployee(epf, batchId, transaction) {
  const [exit] = await findExits(
    { batchId, rejoinedBatchId: null },
    { transaction, employeeWhere: { epf }, limit: 1 },
  );
  if (!exit) {
    throw new ApiError(404, `Employee ${epf} is not on record ${batchId}.`);
  }
  const { isMo } = exit;
  const isTransfer = exit.type === "transfer";
  const otherExits = await EmployeeExit.count({
    where: { employeeId: exit.employeeId, id: { [Op.ne]: exit.id } },
    transaction,
  });
  if (otherExits) {
    await logExit("removed_from_entry", exit, transaction);
    await exit.destroy({ transaction });
    await refreshLegacyExit(exit.employeeId, transaction);
  } else {
    // Employee is a paranoid model (soft-delete by default: destroy() just
    // sets deletedAt and the row stays in the table, invisible only to
    // Sequelize's own default queries). force:true here issues a real SQL
    // DELETE so the row is actually gone from the database, matching what
    // this button promises the user.
    await logExit("employee_deleted", exit, transaction, { employee: exit.employee.get({ plain: true }) });
    await exit.employee.destroy({ transaction, force: true });
  }
  return { epf, isMo, isTransfer };
}

/**
 * Read-only peek at an employee currently on a batch - lets a caller
 * inspect isTransfer/dateOfResign (e.g. to decide whether a Rejoined Date is
 * required, and validate it) before committing to rejoinEmployee's mutation
 * below. Returns null rather than throwing if the epf isn't on this
 * batch, so the caller can shape its own 404 message.
 */
async function findLinkedEmployee(epf, batchId, transaction) {
  const [exit] = await findExits(
    { batchId, rejoinedBatchId: null },
    { transaction, employeeWhere: { epf }, limit: 1 },
  );
  return exit ? exitToRecord(exit) : null;
}

/**
 * Reactivates one resigned/transferred employee - the "Rejoin" counterpart
 * to deleteResignedEmployee above. The exit event is kept as history and
 * marked rejoined (it no longer counts as a standing exit), and the employee's
 * summary columns fall back to whatever other exit they still have, or to
 * plain active-employee master data (see refreshLegacyExit). `rejoinDate`
 * (Resigned/Terminated only - the Transfer tile doesn't ask for one) is
 * stored on dateOfRejoin. `rejoinedBatchId` ties them to whichever batch
 * actually got the Rejoined credit (see dailyCadreService.rejoinResignedEmployee),
 * with rejoinedIsMo recorded alongside it. Returns the event's isMo and
 * isTransfer so the caller can decrement the right tile (Resigned or
 * Transfer) and increment Rejoined by the right type; throws 404 if that epf
 * isn't currently on this batch.
 */
async function rejoinEmployee(epf, batchId, transaction, { rejoinDate = null, rejoinedBatchId = null } = {}) {
  const [exit] = await findExits(
    { batchId, rejoinedBatchId: null },
    { transaction, employeeWhere: { epf }, limit: 1 },
  );
  if (!exit) {
    throw new ApiError(404, `Employee ${epf} is not on record ${batchId}.`);
  }
  const { isMo } = exit;
  const isTransfer = exit.type === "transfer";
  // rejoinedBatchId is what marks an event rejoined, so it must never stay
  // null here - default to the batch it was recorded on.
  const rejoinValues = {
    dateOfRejoin: rejoinDate || null,
    rejoinedBatchId: rejoinedBatchId || batchId,
    rejoinedIsMo: isMo,
  };
  await logExit("rejoined", exit, transaction, rejoinValues);
  await exit.update(rejoinValues, { transaction });
  await refreshLegacyExit(exit.employeeId, transaction);
  return { epf, isMo, isTransfer };
}

/**
 * Detaches every exit event tied to a batch (used when the daily entry
 * itself is deleted) - doesn't delete the employee or their history. The
 * events stay, with batchId cleared, so the exits remain on file as
 * unlinked. A rejoin credited to this batch keeps its rejoinedBatchId:
 * clearing it would make an already-rejoined event look standing again.
 */
async function unlinkBatch(batchId, transaction) {
  const exits = await EmployeeExit.findAll({
    where: { batchId },
    include: [{ model: Employee, as: "employee", required: false }],
    transaction,
  });
  if (!exits.length) return;
  await updateExitsLogged("unlinked_entry_deleted", exits, { batchId: null }, transaction);
  for (const employeeId of new Set(exits.map((ev) => ev.employeeId))) {
    await refreshLegacyExit(employeeId, transaction);
  }
}

/**
 * Exit events (EmployeeExit) matching `where`, each with its Employee
 * (and, on the event, its resignation reason) loaded. MO events first, then
 * TMO, each in employee-id order - see listByBatchIds for why that order matters.
 * `employeeWhere` / `employeeInclude` narrow or extend the joined Employee.
 */
async function findExits(where, { transaction, employeeWhere, employeeInclude, limit } = {}) {
  const employeeJoin = { model: Employee, as: "employee", required: true };
  if (employeeWhere) employeeJoin.where = employeeWhere;
  if (employeeInclude) employeeJoin.include = employeeInclude;
  return EmployeeExit.findAll({
    where,
    include: [employeeJoin, { model: ResignationReason, as: "resignationReason", required: false }],
    order: [
      ["isMo", "DESC"],
      [{ model: Employee, as: "employee" }, "id", "ASC"],
    ],
    limit,
    transaction,
  });
}

/**
 * Flattens an exit event + its Employee into the Employee-shaped plain object
 * the readers used to get straight off employees (epf, dateOfResign, isMo,
 * isTransfer, batchId...), so callers like dailyCadreService.flattenExitEmployee
 * and the LTO analyses didn't have to change. Exit-specific fields come from
 * the event, everything else (name, designation, dates of join/birth...)
 * from the Employee.
 */
function exitToRecord(exit) {
  const employee = exit.employee.get({ plain: true });
  return {
    ...employee,
    id: employee.id,
    batchId: exit.batchId,
    isMo: exit.isMo,
    isTransfer: exit.type === "transfer",
    promotedToMo: exit.promotedToMo,
    newDesignationId: exit.newDesignationId,
    dateOfResign: exit.dateOfExit,
    resignationReasonId: exit.resignationReasonId,
    resignationReason: exit.resignationReason ? exit.resignationReason.get({ plain: true }) : null,
    dateOfRejoin: exit.dateOfRejoin,
    rejoinedBatchId: exit.rejoinedBatchId,
    rejoinedIsMo: exit.rejoinedIsMo,
  };
}

/**
 * Employees currently linked to a set of batchIds, for repopulating the Daily
 * Data Entry / Records table. MO rows first, then TMO, each in entry order -
 * the popup and validator both treat the first `mo` rows as MO, so a stable
 * MO-first order keeps each employee's MO/TMO intact across edits.
 */
async function listByBatchIds(batchIds, transaction) {
  if (!batchIds.length) return [];
  const exits = await findExits({ batchId: { [Op.in]: batchIds }, rejoinedBatchId: null }, { transaction });
  return exits.map(exitToRecord);
}

/**
 * Employees credited as Rejoined against a set of batchIds - backs the
 * Rejoined tile's "view" eye icon. Read from the exit events, so someone who
 * rejoined into a batch and later resigned again still shows there (the
 * Rejoined count they were credited with is still on that batch).
 */
async function listRejoinedByBatchIds(batchIds, transaction) {
  if (!batchIds.length) return [];
  const exits = await findExits({ rejoinedBatchId: { [Op.in]: batchIds } }, { transaction });
  return exits.map(exitToRecord);
}

/** Whole months from dateOfJoin to dateOfResign (both "YYYY-MM-DD"), floored, never negative. */
function monthsOfService(dateOfJoin, dateOfResign) {
  const join = new Date(`${dateOfJoin}T00:00:00Z`);
  const resign = new Date(`${dateOfResign}T00:00:00Z`);
  let months = (resign.getUTCFullYear() - join.getUTCFullYear()) * 12 + (resign.getUTCMonth() - join.getUTCMonth());
  if (resign.getUTCDate() < join.getUTCDate()) months -= 1;
  return Math.max(0, months);
}

/** A cutoff's duration in months as "3 months" / "1 year" / "2 years", for bucket labels. */
function formatDuration(totalMonths) {
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  const parts = [];
  if (years > 0) parts.push(`${years} year${years === 1 ? "" : "s"}`);
  if (months > 0 || years === 0) parts.push(`${months} month${months === 1 ? "" : "s"}`);
  return parts.join(" ");
}

/**
 * This year's resigned employees, optionally narrowed to one factory -
 * shared by every LTO analysis below. Resolved the same way the dashboard's
 * Resigned KPI / Recruitment & Resign trend is (dailyCadreService.getCadreTrend):
 * from the ResignedCarder rows whose entry Date falls in the year (and, for
 * the current year, no later than this month), then the employees linked to
 * those entries via batchId. Going by entry Date rather than the employee's
 * own dateOfResign keeps the two in step - and employees whose entry was
 * deleted or who were trimmed off it (batchId cleared, but dateOfResign left
 * behind) no longer linger in the analysis. Transfer-tile exits
 * (isTransfer: true - e.g. a promotion off the MO/TMO carder) are excluded:
 * LTO/attrition analysis is about people actually leaving, not moving
 * within the company.
 */
async function getResignedEmployeesForYear({ factoryId, year, month, include } = {}) {
  const now = new Date();
  const y = year || now.getFullYear();
  // `month` (1-12) narrows it to that one calendar month - the dashboard's
  // Month filter. Otherwise the whole year, and the dashboard only sums
  // realized months for the current year (see relevantMonthCount in
  // DashboardPage.jsx) - stop at this month's end too.
  const startMonth = month || 1;
  const endMonth = month || (y === now.getFullYear() ? now.getMonth() + 1 : 12);
  const endDay = new Date(Date.UTC(y, endMonth, 0)).getUTCDate();
  const rangeStart = `${y}-${String(startMonth).padStart(2, "0")}-01`;
  const rangeEnd = `${y}-${String(endMonth).padStart(2, "0")}-${String(endDay).padStart(2, "0")}`;

  const batchWhere = { date: { [Op.between]: [rangeStart, rangeEnd] } };
  if (factoryId) batchWhere.factoryId = factoryId;
  const batches = await ResignedCarder.findAll({
    where: batchWhere,
    attributes: ["batchId"],
    raw: true,
  });
  const batchIds = [...new Set(batches.map((b) => b.batchId))];
  if (!batchIds.length) return { year: y, employees: [] };

  // Only true resignations/terminations (type "resign"; legacy rows from
  // before the Transfer tile existed were backfilled as such), and only
  // events still standing - a rejoined one is no longer an exit.
  const exits = await findExits(
    { batchId: { [Op.in]: batchIds }, type: "resign", rejoinedBatchId: null },
    { employeeInclude: include },
  );
  return { year: y, employees: exits.map(exitToRecord) };
}

/**
 * Buckets this year's resigned employees (optionally scoped to one factory)
 * by their length of service at resignation, using the admin-configured
 * cutoffs from Manage Service Ranges - backs the dashboard's "LTO by Length
 * of Service" donut chart (mirrors the "LTO_Analysis_ Service" sheet in the
 * HR Performance Analysis report).
 */
async function getServiceLengthAnalysis({ factoryId, year } = {}) {
  const ranges = await ManageServiceRanges.findAll({
    order: [
      ["years", "ASC"],
      ["months", "ASC"],
    ],
  });
  // No cutoffs configured yet (Manage Service Ranges is empty) - nothing to bucket by.
  if (!ranges.length) {
    return { year: year || new Date().getFullYear(), total: 0, buckets: [] };
  }

  const { year: y, employees } = await getResignedEmployeesForYear({ factoryId, year });

  const cutoffs = ranges.map((r) => r.years * 12 + r.months);
  const labels = cutoffs.map((cutoff, i) =>
    i === 0
      ? `Less than ${formatDuration(cutoff)}`
      : `${formatDuration(cutoffs[i - 1])} to less than ${formatDuration(cutoff)}`
  );
  labels.push(`${formatDuration(cutoffs[cutoffs.length - 1])} and above`);

  const counts = new Array(labels.length).fill(0);
  employees.forEach((emp) => {
    const months = monthsOfService(emp.dateOfJoin, emp.dateOfResign);
    const idx = cutoffs.findIndex((cutoff) => months < cutoff);
    counts[idx === -1 ? labels.length - 1 : idx] += 1;
  });

  const total = counts.reduce((sum, c) => sum + c, 0);
  return {
    year: y,
    total,
    buckets: labels.map((label, i) => ({ label, count: counts[i] })),
  };
}

// A pie with every configured resignation reason (14 in the source workbook)
// is unreadable, and the data-viz guidance is explicit: never generate a hue
// past the categorical palette's safe count - fold the rest into "Other"
// instead. This caps how many reasons get their own named slice.
const MAX_NAMED_REASONS = 7;

/**
 * This year's resigned employees (optionally scoped to one factory), grouped
 * by resignation reason - backs the dashboard's "LTO by Reason" pie chart
 * (mirrors the "LTO_ Analysis_Reason" sheet in the HR Performance Analysis
 * report). Sorted by count descending; only the top MAX_NAMED_REASONS get
 * their own slice, the rest (plus any employee left without a reason) fold
 * into a single "Other" bucket.
 */
async function getReasonAnalysis({ factoryId, year, month } = {}) {
  const { year: y, employees } = await getResignedEmployeesForYear({
    factoryId,
    year,
    month,
    include: [{ model: ResignationReason, as: "resignationReason", attributes: ["resignedReason"] }],
  });

  const counts = new Map(); // reasonId -> { label, count }
  let unassigned = 0;
  employees.forEach((emp) => {
    if (!emp.resignationReasonId) {
      unassigned += 1;
      return;
    }
    const label = emp.resignationReason?.resignedReason?.trim() || `Reason #${emp.resignationReasonId}`;
    const entry = counts.get(emp.resignationReasonId) || { label, count: 0 };
    entry.count += 1;
    counts.set(emp.resignationReasonId, entry);
  });

  const sorted = [...counts.values()].sort((a, b) => b.count - a.count);
  const named = sorted.slice(0, MAX_NAMED_REASONS);
  const otherCount = sorted.slice(MAX_NAMED_REASONS).reduce((sum, r) => sum + r.count, 0) + unassigned;

  const reasons = named.map((r) => ({ label: r.label, count: r.count }));
  if (otherCount > 0) reasons.push({ label: "Other", count: otherCount });

  return {
    year: y,
    total: reasons.reduce((sum, r) => sum + r.count, 0),
    reasons,
  };
}

// Fixed slice order for getCivilStatusAnalysis below. civilStatus is a plain
// string column (not an ENUM), so anything else - blank on older rows
// entered before the field existed, or an unexpected value - lands in
// "Not Recorded".
const CIVIL_STATUSES = ["Married", "Unmarried"];

/**
 * This year's resigned employees (optionally scoped to one factory), grouped
 * by civil status (Married / Unmarried, as collected on the Resigned/
 * Terminated popup) - backs the dashboard's "LTO by Civil Status" donut chart.
 */
async function getCivilStatusAnalysis({ factoryId, year, month } = {}) {
  const { year: y, employees } = await getResignedEmployeesForYear({ factoryId, year, month });

  const counts = new Map(CIVIL_STATUSES.map((label) => [label, 0]));
  let notRecorded = 0;
  employees.forEach((emp) => {
    const status = CIVIL_STATUSES.find(
      (s) => s.toLowerCase() === (emp.civilStatus || "").trim().toLowerCase()
    );
    if (status) counts.set(status, counts.get(status) + 1);
    else notRecorded += 1;
  });

  const statuses = CIVIL_STATUSES.map((label) => ({ label, count: counts.get(label) }));
  if (notRecorded > 0) statuses.push({ label: "Not Recorded", count: notRecorded });

  return {
    year: y,
    total: employees.length,
    statuses,
  };
}

/**
 * This year's resigned employees (optionally scoped to one factory), grouped
 * by section - backs the dashboard's "LTO by Section" donut chart. Same
 * top-MAX_NAMED_REASONS + "Other" folding as getReasonAnalysis above, for
 * the same readability reason.
 */
async function getSectionAnalysis({ factoryId, year, month } = {}) {
  const { year: y, employees } = await getResignedEmployeesForYear({
    factoryId,
    year,
    month,
    include: [{ model: Section, as: "section", attributes: ["sectionName"] }],
  });

  const counts = new Map(); // sectionId -> { label, count }
  employees.forEach((emp) => {
    const label = emp.section?.sectionName?.trim() || `Section #${emp.sectionId}`;
    const entry = counts.get(emp.sectionId) || { label, count: 0 };
    entry.count += 1;
    counts.set(emp.sectionId, entry);
  });

  const sorted = [...counts.values()].sort((a, b) => b.count - a.count);
  const sections = sorted.slice(0, MAX_NAMED_REASONS).map((s) => ({ label: s.label, count: s.count }));
  const otherCount = sorted.slice(MAX_NAMED_REASONS).reduce((sum, s) => sum + s.count, 0);
  if (otherCount > 0) sections.push({ label: "Other", count: otherCount });

  return {
    year: y,
    total: employees.length,
    sections,
  };
}

// Age bands for getAgeAnalysis below, inclusive on both ends (max null = no
// upper bound).
const AGE_BANDS = [
  { label: "16-18", min: 16, max: 18 },
  { label: "19-30", min: 19, max: 30 },
  { label: "31-40", min: 31, max: 40 },
  { label: "41-50", min: 41, max: 50 },
  { label: "Greater than 50", min: 51, max: null },
];

/** Whole years from dateOfBirth to dateOfResign (both "YYYY-MM-DD"), i.e. their age on the day they resigned. */
function ageAtResign(dateOfBirth, dateOfResign) {
  const [by, bm, bd] = dateOfBirth.split("-").map(Number);
  const [ry, rm, rd] = dateOfResign.split("-").map(Number);
  let age = ry - by;
  if (rm < bm || (rm === bm && rd < bd)) age -= 1;
  return age;
}

/**
 * This year's resigned employees (optionally scoped to one factory), grouped
 * by age at resignation (dateOfResign - dateOfBirth) into AGE_BANDS - backs
 * the dashboard's "LTO by Age" donut chart. Employees without a Date of
 * Birth (older rows entered before the field existed, or left blank) land in
 * "Not Recorded"; anyone under the lowest band gets an "Under 16" slice
 * rather than being silently dropped - both only appear when non-zero.
 */
async function getAgeAnalysis({ factoryId, year, month } = {}) {
  const { year: y, employees } = await getResignedEmployeesForYear({ factoryId, year, month });

  const counts = new Array(AGE_BANDS.length).fill(0);
  let underMin = 0;
  let notRecorded = 0;
  employees.forEach((emp) => {
    if (!emp.dateOfBirth || !emp.dateOfResign) {
      notRecorded += 1;
      return;
    }
    const age = ageAtResign(emp.dateOfBirth, emp.dateOfResign);
    const idx = AGE_BANDS.findIndex((b) => age >= b.min && (b.max === null || age <= b.max));
    if (idx === -1) underMin += 1;
    else counts[idx] += 1;
  });

  const bands = AGE_BANDS.map((b, i) => ({ label: b.label, count: counts[i] }));
  if (underMin > 0) bands.unshift({ label: `Under ${AGE_BANDS[0].min}`, count: underMin });
  if (notRecorded > 0) bands.push({ label: "Not Recorded", count: notRecorded });

  return {
    year: y,
    total: employees.length,
    bands,
  };
}

// ---------------------------------------------------------------------------
// Employee Master (Manage Employees admin page) - general employee-details
// CRUD, independent of the Daily Data Entry "Resigned Employees" flow above.
// Shares the same table: an employee created/edited here is the same record
// the resigned-employee popup would later find/update by epf.
// ---------------------------------------------------------------------------

const EMPLOYEE_INCLUDE = [
  { model: Designation, as: "designation", attributes: ["id", "designation"] },
  { model: Department, as: "department", attributes: ["id", "departmentName"] },
  { model: Section, as: "section", attributes: ["id", "sectionName"] },
  { model: ResignationReason, as: "resignationReason", attributes: ["id", "resignedReason"] },
];

const DEFAULT_PAGE_SIZE = 20;

/**
 * Employees have no factory column of their own - they belong to a factory
 * through their department (Department.factoryId). These are the department
 * ids for `factoryId`; null (a user with no factory assigned) matches none.
 */
async function departmentIdsForFactory(factoryId) {
  if (factoryId == null) return [];
  const departments = await Department.findAll({
    where: { factoryId },
    attributes: ["id"],
    raw: true,
  });
  return departments.map((d) => d.id);
}

/**
 * Backs the Manage Employees page: one page of every employee, most recently
 * added first - or, with a search term, of the employees whose EPF number
 * contains it (partial match, so "123" finds "EPF00123"), sorted by EPF.
 * Returns { rows, total, page, pageSize }, `total` being the full match
 * count across all pages. `factoryId` (set for the User role - see
 * employeeController.scopedFactoryId) narrows it to that factory's
 * employees; `incomplete` to those still missing a Date of Birth or Civil
 * Status.
 */
async function listEmployees({ search, page = 1, pageSize = DEFAULT_PAGE_SIZE, factoryId, incomplete } = {}) {
  const where = {};
  if (search) where.epf = { [Op.substring]: search };
  if (incomplete) {
    where[Op.or] = [{ dateOfBirth: null }, { civilStatus: null }, { civilStatus: "" }];
  }
  if (factoryId !== undefined) {
    where.departmentId = { [Op.in]: await departmentIdsForFactory(factoryId) };
  }
  const { rows, count } = await Employee.findAndCountAll({
    where,
    include: EMPLOYEE_INCLUDE,
    order: search ? [["epf", "ASC"]] : [["createdAt", "DESC"], ["id", "DESC"]],
    limit: pageSize,
    offset: (page - 1) * pageSize,
    // Every include is a belongsTo, so this doesn't change the count - just
    // keeps Sequelize from counting joined rows.
    distinct: true,
  });
  return { rows, total: count, page, pageSize };
}

/**
 * Employees who still carry an exit (dateOfResign) but are no longer tied to
 * any Daily Data Entry - their entry was deleted (unlinkBatch) or they were
 * trimmed off it (syncResignedEmployees' unlink step), both of which clear
 * batchId but leave the exit fields behind. Also includes anyone given a
 * Date of Resign directly on the Manage Employees page. Transfer-tile rows
 * are never unlinked with isTransfer intact, so there's no telling them
 * apart here - backs the Daily Entry page's "Unlinked Employees" list.
 */
async function listUnlinkedResignedEmployees() {
  return Employee.findAll({
    where: { batchId: null, dateOfResign: { [Op.ne]: null } },
    include: EMPLOYEE_INCLUDE,
    order: [
      ["dateOfResign", "DESC"],
      ["epf", "ASC"],
    ],
  });
}

async function getEmployeeOr404(id) {
  const employee = await Employee.findByPk(id, { include: EMPLOYEE_INCLUDE });
  if (!employee) {
    throw new ApiError(404, `Employee ${id} not found.`);
  }
  return employee;
}

/** Rejects a duplicate EPF number (unique across all employees), excluding `excludeId` on updates. */
async function assertEpfAvailable(epf, excludeId) {
  const existing = await Employee.findOne({ where: { epf } });
  if (existing && existing.id !== excludeId) {
    throw new ApiError(409, `EPF number "${epf}" is already assigned to another employee.`);
  }
  // epf is unique across soft-deleted rows too - catch that here instead of
  // letting the insert/update fail on the DB's unique index.
  const softDeleted = await Employee.findOne({
    where: { epf, deletedAt: { [Op.ne]: null } },
    paranoid: false,
  });
  if (softDeleted && softDeleted.id !== excludeId) return softDeleted;
  return null;
}

/**
 * The Daily Data Entry batch a resignation typed into Manage Employees belongs
 * to: the entry for the employee's factory (via their department) dated the
 * resign date. Throws 409 unless exactly one entry matches - none leaves
 * nothing to link to, and a factory may log several entries for one date
 * (see dailyCadreService.createDailyRecord), so picking one would be a guess.
 */
async function resolveBatchForResign(departmentId, dateOfResign, transaction) {
  const department = await Department.findByPk(departmentId, { attributes: ["factoryId"], transaction });
  if (!department) throw new ApiError(400, "Department not found.");
  const entries = await PlannedCarder.findAll({
    where: { factoryId: department.factoryId, date: dateOfResign },
    attributes: ["batchId"],
    transaction,
  });
  if (entries.length === 1) return entries[0].batchId;
  const factory = await Factory.findByPk(department.factoryId, { attributes: ["factoryName"], transaction });
  const where = `${factory?.factoryName ? `${factory.factoryName} ` : ""}daily entry dated ${dateOfResign}`;
  throw new ApiError(
    409,
    entries.length
      ? `There is more than one ${where}, so the resignation can't be linked automatically. Resolve the duplicate entries first.`
      : `There is no ${where}. Create the Daily Data Entry first, then record the resignation.`,
  );
}

/**
 * Records the resign exit for an employee whose Date of Resign was just saved
 * on Manage Employees, tying it to the matching Daily Data Entry. `previous`
 * is the employee's batchId/dateOfResign/isTransfer from before the save.
 * Runs inside the caller's transaction.
 */
async function linkResignationToBatch(employee, fields, previous, transaction) {
  const linked = !!previous.batchId;
  const editInPlace = async (batchId) => {
    const exits = await EmployeeExit.findAll({
      where: { employeeId: employee.id, batchId, rejoinedBatchId: null },
      transaction,
    });
    if (!exits.length) return;
    await updateExitsLogged(
      "edited_in_manage_employees",
      exits,
      { dateOfExit: fields.dateOfResign, resignationReasonId: fields.resignationReasonId ?? null },
      transaction,
    );
  };

  // Already on an entry as a transfer, or the date didn't change: just keep
  // that event's date/reason in step.
  if (linked && (previous.isTransfer || previous.dateOfResign === fields.dateOfResign)) {
    await editInPlace(previous.batchId);
    return;
  }

  const batchId = await resolveBatchForResign(fields.departmentId, fields.dateOfResign, transaction);
  if (linked) {
    if (batchId === previous.batchId) {
      await editInPlace(batchId);
    } else {
      // Date moved to a day with a different entry - move the exit with it.
      const moving = await EmployeeExit.findAll({
        where: { employeeId: employee.id, batchId: previous.batchId, type: "resign", rejoinedBatchId: null },
        transaction,
      });
      if (moving.length) {
        await updateExitsLogged(
          "moved_to_other_entry",
          moving,
          { batchId, dateOfExit: fields.dateOfResign, resignationReasonId: fields.resignationReasonId ?? null },
          transaction,
        );
      }
    }
  } else {
    await assertCanRecordExit(employee, batchId, false, fields.dateOfResign, transaction);
    await recordExit(employee.id, batchId, false, { ...fields, isMo: employee.isMo ?? null }, transaction);
  }
  await refreshLegacyExit(employee.id, transaction);
}

async function createEmployeeRecord(fields) {
  const softDeleted = await assertEpfAvailable(fields.epf);
  return Employee.sequelize.transaction(async (transaction) => {
    let employee;
    // A soft-deleted employee (e.g. a cleaned-up unlinked resignation) with
    // this epf - bring that row back with the new details instead of inserting.
    if (softDeleted) {
      await softDeleted.restore({ transaction });
      // Whatever exits it carried belong to the record that was cleaned up.
      await destroyExitsLogged(softDeleted.id, "purged_on_restore", transaction);
      employee = await softDeleted.update(
        {
          ...fields,
          batchId: null,
          isMo: null,
          isTransfer: null,
          promotedToMo: null,
          newDesignationId: null,
          dateOfRejoin: null,
          rejoinedBatchId: null,
          rejoinedIsMo: null,
        },
        { transaction },
      );
    } else {
      employee = await Employee.create(fields, { transaction });
    }
    if (fields.dateOfResign) {
      await linkResignationToBatch(
        employee,
        fields,
        { batchId: null, dateOfResign: null, isTransfer: null },
        transaction,
      );
    }
    return getEmployeeOr404(employee.id);
  });
}

/**
 * `factoryId` (set for the User role - see employeeController.scopedFactoryId)
 * limits the edit to that factory's employees, and stops them being moved
 * into another factory's department. An employee outside the factory is
 * reported as not found rather than forbidden, so other factories'
 * employee ids aren't confirmed to exist.
 */
async function updateEmployeeRecord(id, body, { factoryId } = {}) {
  const { confirmRelink, ...fields } = body;
  const employee = await getEmployeeOr404(id);
  if (factoryId !== undefined) {
    const allowed = await departmentIdsForFactory(factoryId);
    if (!allowed.includes(employee.departmentId)) {
      throw new ApiError(404, `Employee ${id} not found.`);
    }
    if (!allowed.includes(fields.departmentId)) {
      throw new ApiError(403, "You can only assign departments from your own factory.");
    }
  }
  if (await assertEpfAvailable(fields.epf, employee.id)) {
    throw new ApiError(409, `EPF number "${fields.epf}" belongs to a deleted employee record.`);
  }

  const previous = {
    batchId: employee.batchId,
    dateOfResign: employee.dateOfResign,
    isTransfer: employee.isTransfer,
  };
  // The exit lives on a Daily Data Entry; clearing the date here would leave
  // that entry's event standing while the employee reads as active.
  if (!fields.dateOfResign && previous.batchId && previous.dateOfResign) {
    throw new ApiError(
      409,
      "This employee's resignation is linked to a Daily Data Entry. Remove them from that entry first to clear the Date of Resign.",
    );
  }

  // Moving the date of a resignation that's tied to a Daily Data Entry
  // re-links it to whichever entry is dated the new day - make the user
  // confirm that before touching anything.
  if (
    fields.dateOfResign &&
    previous.batchId &&
    previous.dateOfResign &&
    !previous.isTransfer &&
    previous.dateOfResign !== fields.dateOfResign &&
    !confirmRelink
  ) {
    throw new ApiError(
      409,
      `This employee's resignation (${previous.dateOfResign})${await describeBatch(previous.batchId)}. Changing the Date of Resign to ${fields.dateOfResign} will move it to the daily entry dated ${fields.dateOfResign}. Do you want to continue?`,
      "CONFIRM_RELINK",
    );
  }

  await Employee.sequelize.transaction(async (transaction) => {
    await employee.update(fields, { transaction });
    // dateOfResign / resignationReasonId describe the employee's current exit.
    // Reads come from employeeexits, so create/keep its event in step and tie
    // it to the matching Daily Data Entry.
    if (fields.dateOfResign) await linkResignationToBatch(employee, fields, previous, transaction);
  });
  return getEmployeeOr404(id);
}

/**
 * Hard-deletes an employee record (Employee is paranoid, so a plain destroy()
 * would just soft-delete it - force:true actually removes the row, matching
 * what the Delete button on the Manage Employees page promises). Refuses to
 * delete an employee currently linked to a Daily Data Entry batch (see
 * syncResignedEmployees above) so that entry's resigned-employee history
 * isn't silently orphaned - it must be removed from that entry first.
 */
async function deleteEmployeeRecord(id) {
  const employee = await getEmployeeOr404(id);
  // Any standing exit still on a daily entry (not just the current one the
  // summary columns show) - deleting the employee would take its events with it.
  const onEntry = await EmployeeExit.count({
    where: { employeeId: employee.id, rejoinedBatchId: null, batchId: { [Op.ne]: null } },
  });
  if (onEntry) {
    throw new ApiError(
      409,
      "This employee is linked to a resigned-employee record on a Daily Data Entry and can't be deleted here. Remove them from that entry first.",
    );
  }
  await Employee.sequelize.transaction(async (transaction) => {
    // The FK cascade takes this employee's remaining (rejoined / unlinked)
    // exit events with them - keep a copy of each.
    const exits = await EmployeeExit.findAll({ where: { employeeId: employee.id }, transaction });
    for (const ev of exits) {
      await logExit("employee_deleted", ev, transaction, { employee: employee.get({ plain: true }) });
    }
    await employee.destroy({ force: true, transaction });
  });
  return employee;
}

module.exports = {
  syncResignedEmployees,
  deleteResignedEmployee,
  findLinkedEmployee,
  rejoinEmployee,
  unlinkBatch,
  listByBatchIds,
  listRejoinedByBatchIds,
  getServiceLengthAnalysis,
  getReasonAnalysis,
  getCivilStatusAnalysis,
  getSectionAnalysis,
  getAgeAnalysis,
  listUnlinkedResignedEmployees,
  listEmployees,
  createEmployeeRecord,
  updateEmployeeRecord,
  deleteEmployeeRecord,
};
