import api from "./api";

/** Weeks available for the cadre filters (id, week [DATEONLY string]). */
export function getWeeks() {
  return api.get("/weeks");
}

/** Creates a new week (date must be unique). */
export function createWeek(week) {
  return api.post("/weeks", { week });
}

/** Updates an existing week's date. */
export function updateWeek(id, week) {
  return api.put(`/weeks/${id}`, { week });
}
