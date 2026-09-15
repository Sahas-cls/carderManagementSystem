"use strict";

const { Op } = require("sequelize");
const {
  Employee,
  Designation,
  Department,
  Section,
  ManageServiceRanges,
  ResignationReason,
  ResignedCarder,
} = require("../../models");
const ApiError = require("../utils/ApiError");

/**
 * Creates/updates the Employee rows for the Resigned/Transfer Employee popup
 * on the Daily Data Entry form (see CadreDetailsCard.jsx's
 * ResignedEmployeesModal) and links them to this daily entry's batch.
 * `isTransfer` tags which of the two tiles this call is syncing for (false =
 * Resigned/Terminated, true = Transfer) - dailyCadreService.performUpdate
 * calls this once per tile for the same batch, so the unlink step below is
 * scoped to rows of that same type only: an employee of the OTHER type still
 * linked to this batch must not be touched by this call.
 *
 * `epf` is upserted rather than always inserted: epf is unique on Employee,
 * and re-saving the same daily entry (edit) resubmits the same rows, so an
 * insert-only approach would collide on epf. Any employee of this type
 * previously linked to this batch but no longer present in `employees` is
 * unlinked (batchId/isMo/isTransfer cleared) rather than deleted - the
 * employee record itself is real master data (their exit happened), only
 * its tie to this particular entry is undone.
 */
async function syncResignedEmployees(employees, batchId, transaction, isTransfer = false) {
  const list = Array.isArray(employees) ? employees : [];

  for (const emp of list) {
    const fields = {
      employeeName: emp.employeeName,
      designationId: emp.designationId,
      departmentId: emp.departmentId,
      sectionId: emp.sectionId,
      dateOfJoin: emp.dateOfJoin,
      dateOfResign: emp.dateOfResign,
      resignationReasonId: emp.resignationReasonId ?? null,
      batchId,
      isMo: emp.isMo,
      isTransfer,
      // Only meaningful for a Transfer-tile row (isTransfer: true) that was
      // originally TMO - whether they're staying (promoted to MO) or
      // leaving. Ignored/null for Resigned/Terminated rows.
      promotedToMo: isTransfer ? !!emp.promotedToMo : null,
    };

    const [record, created] = await Employee.findOrCreate({
      where: { epf: emp.epf },
      defaults: { epf: emp.epf, ...fields },
      transaction,
    });
    if (!created) {
      await record.update(fields, { transaction });
    }
  }

  const currentEpfs = list.map((emp) => emp.epf);
  const unlinkWhere = { batchId, isTransfer };
  if (currentEpfs.length) {
    unlinkWhere.epf = { [Op.notIn]: currentEpfs };
  }
  await Employee.update(
    { batchId: null, isMo: null, isTransfer: null, promotedToMo: null },
    { where: unlinkWhere, transaction },
  );
}

/**
 * Permanently deletes one resigned/transferred employee (a real hard delete,
 * unlike syncResignedEmployees' unlink-only trimming above) - backs the
 * per-employee Delete button in ResignedEmployeesModal.jsx. Scoped to the
 * batch the employee is currently linked to, so a stray epf can't delete
 * unrelated master data via this route. Returns the deleted row's isMo (true
 * = MO, false = TMO) and isTransfer (true = Transfer tile, false = Resigned/
 * Terminated tile) so the caller can decrement the right tile's count;
 * throws 404 if that epf isn't currently linked to this batch (e.g. it was
 * only added to the form this session and never actually saved yet).
 */
async function deleteResignedEmployee(epf, batchId, transaction) {
  const employee = await Employee.findOne({ where: { epf, batchId }, transaction });
  if (!employee) {
    throw new ApiError(404, `Employee ${epf} is not on record ${batchId}.`);
  }
  const { isMo, isTransfer } = employee;
  // Employee is a paranoid model (soft-delete by default: destroy() just
  // sets deletedAt and the row stays in the table, invisible only to
  // Sequelize's own default queries). force:true here issues a real SQL
  // DELETE so the row is actually gone from the database, matching what
  // this button promises the user.
  await employee.destroy({ transaction, force: true });
  return { epf, isMo, isTransfer };
}

/**
 * Reactivates one resigned/transferred employee - the "Rejoin" counterpart
 * to deleteResignedEmployee above. Instead of hard-deleting the Employee
 * row, clears its exit fields (dateOfResign, resignationReasonId) and
 * unlinks it from the batch (batchId/isMo/isTransfer), so the employee is
 * active again and reappears as ordinary employee master data. Returns the
 * row's isMo and isTransfer as they were before being cleared, so the
 * caller can decrement the right tile (Resigned or Transfer) and increment
 * Rejoined by the right type; throws 404 if that epf isn't currently linked
 * to this batch.
 */
async function rejoinEmployee(epf, batchId, transaction) {
  const employee = await Employee.findOne({ where: { epf, batchId }, transaction });
  if (!employee) {
    throw new ApiError(404, `Employee ${epf} is not on record ${batchId}.`);
  }
  const { isMo, isTransfer } = employee;
  await employee.update(
    {
      dateOfResign: null,
      resignationReasonId: null,
      batchId: null,
      isMo: null,
      isTransfer: null,
      promotedToMo: null,
    },
    { transaction },
  );
  return { epf, isMo, isTransfer };
}

/** Unlinks every employee tied to a batch (used when the daily entry itself is deleted) - doesn't delete the employee record. */
async function unlinkBatch(batchId, transaction) {
  await Employee.update(
    { batchId: null, isMo: null, isTransfer: null, promotedToMo: null },
    { where: { batchId }, transaction },
  );
}

/** Employees currently linked to a set of batchIds, for repopulating the Daily Data Entry / Records table. */
async function listByBatchIds(batchIds, transaction) {
  if (!batchIds.length) return [];
  return Employee.findAll({ where: { batchId: { [Op.in]: batchIds } }, transaction });
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
 * This year's resigned employees, optionally narrowed to one factory.
 * Employee has no factoryId of its own, so a factory filter is resolved via
 * batchId -> the ResignedCarder row for the daily entry that recorded the
 * resignation - shared by every LTO analysis below. Transfer-tile exits
 * (isTransfer: true - e.g. a promotion off the MO/TMO carder) are excluded:
 * LTO/attrition analysis is about people actually leaving, not moving
 * within the company.
 */
async function getResignedEmployeesForYear({ factoryId, year, include } = {}) {
  const y = year || new Date().getFullYear();
  const employees = await Employee.findAll({
    where: {
      dateOfResign: { [Op.between]: [`${y}-01-01`, `${y}-12-31`] },
      // NULL (legacy rows from before the Transfer tile existed) counts as
      // "not a transfer" here, same as it always implicitly did.
      [Op.or]: [{ isTransfer: false }, { isTransfer: null }],
    },
    include,
  });

  if (!factoryId) return { year: y, employees };

  const batches = await ResignedCarder.findAll({
    where: { factoryId },
    attributes: ["batchId"],
    raw: true,
  });
  const allowedBatchIds = new Set(batches.map((b) => b.batchId));
  return { year: y, employees: employees.filter((emp) => allowedBatchIds.has(emp.batchId)) };
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
async function getReasonAnalysis({ factoryId, year } = {}) {
  const { year: y, employees } = await getResignedEmployeesForYear({
    factoryId,
    year,
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

const DEFAULT_RECENT_LIMIT = 10;
const SEARCH_RESULT_LIMIT = 50;

/**
 * Backs the Manage Employees page: with no search term, the 10 (or `limit`)
 * most recently added employees; with a search term, up to SEARCH_RESULT_LIMIT
 * employees whose EPF number contains it (partial match, so "123" finds
 * "EPF00123").
 */
async function listEmployees({ search, limit } = {}) {
  if (search) {
    return Employee.findAll({
      where: { epf: { [Op.substring]: search } },
      include: EMPLOYEE_INCLUDE,
      order: [["epf", "ASC"]],
      limit: SEARCH_RESULT_LIMIT,
    });
  }
  return Employee.findAll({
    include: EMPLOYEE_INCLUDE,
    order: [["createdAt", "DESC"]],
    limit: limit || DEFAULT_RECENT_LIMIT,
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
}

async function createEmployeeRecord(fields) {
  await assertEpfAvailable(fields.epf);
  const employee = await Employee.create(fields);
  return getEmployeeOr404(employee.id);
}

async function updateEmployeeRecord(id, fields) {
  const employee = await getEmployeeOr404(id);
  await assertEpfAvailable(fields.epf, employee.id);

  await employee.update(fields);
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
  if (employee.batchId) {
    throw new ApiError(
      409,
      "This employee is linked to a resigned-employee record on a Daily Data Entry and can't be deleted here. Remove them from that entry first.",
    );
  }
  await employee.destroy({ force: true });
  return employee;
}

module.exports = {
  syncResignedEmployees,
  deleteResignedEmployee,
  rejoinEmployee,
  unlinkBatch,
  listByBatchIds,
  getServiceLengthAnalysis,
  getReasonAnalysis,
  listEmployees,
  createEmployeeRecord,
  updateEmployeeRecord,
  deleteEmployeeRecord,
};
