import api from "./api";

/** Fetches TC (Training Center) budgets, optionally scoped to one factory. */
export function getTcBudgets(factoryId) {
  return api.get("/tc-budgets", { params: factoryId ? { factoryId } : {} });
}

export function createTcBudget(tcBudget) {
  return api.post("/tc-budgets", { tcBudget });
}

export function editTcBudget(id, tcBudget) {
  return api.put(`/tc-budgets/${id}`, { tcBudget });
}

export function deleteTcBudget(id) {
  return api.delete(`/tc-budgets/${id}`);
}

/** Activates/deactivates a TC budget. Activating one deactivates every other TC budget for the same factory. */
export function setTcBudgetStatus(id, status) {
  return api.patch(`/tc-budgets/${id}/status`, { status });
}
