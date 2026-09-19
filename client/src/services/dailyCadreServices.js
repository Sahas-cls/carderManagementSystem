import api from "./api";

/**
 * Daily Data Entry records for a calendar month (defaults to the current
 * month), newest-entered first. Optionally scoped to one factory.
 */
export function listDailyRecords({ year, month, factoryId } = {}) {
  const params = {};
  if (year) params.year = year;
  if (month) params.month = month;
  if (factoryId) params.factoryId = factoryId;
  return api.get("/cadre/daily", { params });
}

/** Creates a new Daily Data Entry record. A factory may have several entries for the same date - nothing is merged. */
export function createDailyRecord(payload) {
  return api.post("/cadre/daily", payload);
}

/** Updates every field of an existing record (identified by its batchId). This is a full replace, not a partial patch. */
export function updateDailyRecord(batchId, payload) {
  return api.put(`/cadre/daily/${batchId}`, payload);
}

/** Permanently deletes a record. */
export function deleteDailyRecord(batchId) {
  return api.delete(`/cadre/daily/${batchId}`);
}

/**
 * Permanently deletes one Resigned/Terminated employee from an already-saved
 * Daily Data Entry record - hard-deletes the Employee row itself (not just
 * removing it from this entry) and immediately re-saves the batch's Resigned
 * MO/TMO count (and everything derived from it) to match. Backs the per-
 * employee Delete button in ResignedEmployeesModal.jsx; only call this for a
 * batchId that's already been saved - a brand-new, not-yet-added record has
 * nothing in the database yet to delete.
 */
export function deleteResignedEmployee(batchId, epf) {
  return api.delete(`/cadre/daily/${batchId}/resigned/${encodeURIComponent(epf)}`);
}

/**
 * Reactivates one Resigned/Terminated or Transfer employee from an
 * already-saved Daily Data Entry record - the Employee row itself survives
 * (only its exit fields are cleared). `rejoinDate` (Resigned/Terminated
 * only - required there, omitted for Transfer) picks which daily record the
 * Rejoined MO/TMO credit lands on: this same batch's Resigned count always
 * moves down by one, but Rejoined goes to whichever record actually covers
 * the factory on that date (a 400 if there isn't one yet). Backs the
 * per-employee Rejoin button in ResignedEmployeesListModal.jsx; only call
 * this for a batchId that's already been saved.
 */
export function rejoinResignedEmployee(batchId, epf, rejoinDate) {
  return api.patch(
    `/cadre/daily/${batchId}/resigned/${encodeURIComponent(epf)}/rejoin`,
    rejoinDate ? { rejoinDate } : {},
  );
}

/**
 * The most recent Daily Data Entry batch for a factory before the given
 * date (whatever date that was), or null if there isn't one. Backs the
 * Daily Data Entry form's prefill - see DailyEntryPage.jsx.
 */
export function getPreviousDailyRecord({ factoryId, date }) {
  return api.get("/cadre/daily/previous", { params: { factoryId, date } });
}

/**
 * Group-wide + per-factory Budget vs Allocated (Actual) trend for a
 * calendar year (defaults to the current year), one point per month.
 * Optionally scoped to one factory.
 */
export function getCadreTrend({ year, factoryId } = {}) {
  const params = {};
  if (year) params.year = year;
  if (factoryId) params.factoryId = factoryId;
  return api.get("/cadre/trend", { params });
}
