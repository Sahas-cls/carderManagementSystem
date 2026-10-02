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
      // Only meaningful for a Transfer-tile row - the designation they're
      // moving into. Ignored/null for Resigned/Terminated rows.
      newDesignationId: isTransfer ? emp.newDesignationId ?? null : null,
      departmentId: emp.departmentId,
      sectionId: emp.sectionId,
      dateOfResign: emp.dateOfResign,
      resignationReasonId: emp.resignationReasonId ?? null,
      batchId,
      isMo: emp.isMo,
      isTransfer,
      // They're resigning/transferring again - whatever they'd previously
      // rejoined into is stale now, same idea as isMo/isTransfer being
      // cleared on the other side (rejoinEmployee below).
      rejoinedBatchId: null,
      rejoinedIsMo: null,
      // Only meaningful for a Transfer-tile row (isTransfer: true) that was
      // originally TMO - whether they're staying (promoted to MO) or
      // leaving. Ignored/null for Resigned/Terminated rows.
      promotedToMo: isTransfer ? !!emp.promotedToMo : null,
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
    if (existing) {
      if (existing.deletedAt) await existing.restore({ transaction });
      await existing.update(fields, { transaction });
    } else {
      await Employee.create(
        { epf: emp.epf, dateOfJoin: isTransfer ? emp.dateOfResign : emp.dateOfJoin, ...fields },
        { transaction },
      );
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
 * Read-only peek at an employee currently linked to a batch - lets a caller
 * inspect isTransfer/dateOfResign (e.g. to decide whether a Rejoined Date is
 * required, and validate it) before committing to rejoinEmployee's mutation
 * below. Returns null rather than throwing if the epf isn't linked to this
 * batch, so the caller can shape its own 404 message.
 */
async function findLinkedEmployee(epf, batchId, transaction) {
  return Employee.findOne({ where: { epf, batchId }, transaction });
}

/**
 * Reactivates one resigned/transferred employee - the "Rejoin" counterpart
 * to deleteResignedEmployee above. Instead of hard-deleting the Employee
 * row, clears its exit fields (dateOfResign, resignationReasonId,
 * newDesignationId) and unlinks it from the batch (batchId/isMo/
 * isTransfer), so the employee is active again and reappears as ordinary
 * employee master data. `rejoinDate` (Resigned/Terminated only - the
 * Transfer tile doesn't ask for one) is stored on dateOfRejoin, overwriting
 * whatever was there before. `rejoinedBatchId` ties them to whichever batch
 * actually got the Rejoined credit (see dailyCadreService.rejoinResignedEmployee)
 * - rejoinedIsMo is recorded alongside it since isMo itself is being cleared
 * here. Returns the row's isMo and isTransfer as they were before being
 * cleared, so the caller can decrement the right tile (Resigned or Transfer)
 * and increment Rejoined by the right type; throws 404 if that epf isn't
 * currently linked to this batch.
 */
async function rejoinEmployee(epf, batchId, transaction, { rejoinDate = null, rejoinedBatchId = null } = {}) {
  const employee = await Employee.findOne({ where: { epf, batchId }, transaction });
  if (!employee) {
    throw new ApiError(404, `Employee ${epf} is not on record ${batchId}.`);
  }
  const { isMo, isTransfer } = employee;
  await employee.update(
    {
      dateOfResign: null,
      resignationReasonId: null,
      newDesignationId: null,
      batchId: null,
      isMo: null,
      isTransfer: null,
      promotedToMo: null,
      dateOfRejoin: rejoinDate || null,
      rejoinedBatchId: rejoinedBatchId || null,
      rejoinedIsMo: rejoinedBatchId ? isMo : null,
    },
    { transaction },
  );
  return { epf, isMo, isTransfer };
}

/**
 * Unlinks every employee tied to a batch (used when the daily entry itself
 * is deleted) - doesn't delete the employee record. Clears both directions:
 * employees resigned/transferred INTO this batch (batchId), and employees
 * rejoined-credited to this batch (rejoinedBatchId) - the batch is gone
 * either way, so neither link should dangle.
 */
async function unlinkBatch(batchId, transaction) {
  await Employee.update(
    { batchId: null, isMo: null, isTransfer: null, promotedToMo: null },
    { where: { batchId }, transaction },
  );
  await Employee.update(
    { rejoinedBatchId: null, rejoinedIsMo: null },
    { where: { rejoinedBatchId: batchId }, transaction },
  );
}

/** Employees currently linked to a set of batchIds, for repopulating the Daily Data Entry / Records table. */
async function listByBatchIds(batchIds, transaction) {
  if (!batchIds.length) return [];
  return Employee.findAll({ where: { batchId: { [Op.in]: batchIds } }, transaction });
}

/** Employees currently credited as Rejoined against a set of batchIds - backs the Rejoined tile's "view" eye icon. */
async function listRejoinedByBatchIds(batchIds, transaction) {
  if (!batchIds.length) return [];
  return Employee.findAll({ where: { rejoinedBatchId: { [Op.in]: batchIds } }, transaction });
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

  const employees = await Employee.findAll({
    where: {
      batchId: { [Op.in]: batchIds },
      // NULL (legacy rows from before the Transfer tile existed) counts as
      // "not a transfer" here, same as it always implicitly did.
      [Op.or]: [{ isTransfer: false }, { isTransfer: null }],
    },
    include,
  });
  return { year: y, employees };
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
 * employees.
 */
async function listEmployees({ search, page = 1, pageSize = DEFAULT_PAGE_SIZE, factoryId } = {}) {
  const where = {};
  if (search) where.epf = { [Op.substring]: search };
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

async function createEmployeeRecord(fields) {
  const softDeleted = await assertEpfAvailable(fields.epf);
  // A soft-deleted employee (e.g. a cleaned-up unlinked resignation) with
  // this epf - bring that row back with the new details instead of inserting.
  if (softDeleted) {
    await softDeleted.restore();
    await softDeleted.update({
      ...fields,
      batchId: null,
      isMo: null,
      isTransfer: null,
      promotedToMo: null,
      newDesignationId: null,
      dateOfRejoin: null,
      rejoinedBatchId: null,
      rejoinedIsMo: null,
    });
    return getEmployeeOr404(softDeleted.id);
  }
  const employee = await Employee.create(fields);
  return getEmployeeOr404(employee.id);
}

/**
 * `factoryId` (set for the User role - see employeeController.scopedFactoryId)
 * limits the edit to that factory's employees, and stops them being moved
 * into another factory's department. An employee outside the factory is
 * reported as not found rather than forbidden, so other factories'
 * employee ids aren't confirmed to exist.
 */
async function updateEmployeeRecord(id, fields, { factoryId } = {}) {
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
