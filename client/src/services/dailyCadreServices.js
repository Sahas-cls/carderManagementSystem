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
