"use strict";

const { Op } = require("sequelize");
const { Employee, ManageServiceRanges, ResignationReason, ResignedCarder } = require("../../models");

/**
 * Creates/updates the Employee rows for the Resigned Employee popup on the
 * Daily Data Entry form (see CadreDetailsCard.jsx's ResignedEmployeesModal)
 * and links them to this daily entry's batch.
 *
 * `epf` is upserted rather than always inserted: epf is unique on Employee,
 * and re-saving the same daily entry (edit) resubmits the same rows, so an
 * insert-only approach would collide on epf. Any employee previously linked
 * to this batch but no longer present in `employees` is unlinked (batchId/
 * isMo cleared) rather than deleted - the employee record itself is real
 * master data (their resignation happened), only its tie to this particular
 * entry is undone.
 */
async function syncResignedEmployees(employees, batchId, transaction) {
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
  const unlinkWhere = { batchId };
  if (currentEpfs.length) {
    unlinkWhere.epf = { [Op.notIn]: currentEpfs };
  }
  await Employee.update(
    { batchId: null, isMo: null },
    { where: unlinkWhere, transaction },
  );
}

/** Unlinks every employee tied to a batch (used when the daily entry itself is deleted) - doesn't delete the employee record. */
async function unlinkBatch(batchId, transaction) {
  await Employee.update(
    { batchId: null, isMo: null },
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
 * resignation - shared by every LTO analysis below.
 */
async function getResignedEmployeesForYear({ factoryId, year, include } = {}) {
  const y = year || new Date().getFullYear();
  const employees = await Employee.findAll({
    where: { dateOfResign: { [Op.between]: [`${y}-01-01`, `${y}-12-31`] } },
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

module.exports = {
  syncResignedEmployees,
  unlinkBatch,
  listByBatchIds,
  getServiceLengthAnalysis,
  getReasonAnalysis,
};
