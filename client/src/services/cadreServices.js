import api from "./api";

/** Factories available for the cadre filters (id, factoryName). */
export function getFactories() {
  return api.get("/factories");
}

/**
 * Weekly Data View rows - one per (week, factory) pair, summing every Daily
 * Data Entry submission in that week for that factory across the Allocated
 * Actual / Absenteeism / Present / Training Center carder data. Read-only:
 * Weekly View has no data of its own, it's an aggregate of Daily Entry.
 * Both filters are optional; pass the numeric id from getFactories()/getWeeks().
 */
export function getWeeklyCadre({ factoryId, weekId } = {}) {
  const params = {};
  if (factoryId) params.factoryId = factoryId;
  if (weekId) params.weekId = weekId;
  return api.get("/cadre/weekly", { params });
}
