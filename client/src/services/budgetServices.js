import api from "./api";

/** Fetches budgets, optionally scoped to one factory. */
export function getBudgets(factoryId) {
  return api.get("/budgets", { params: factoryId ? { factoryId } : {} });
}

export function createBudget(budget) {
  return api.post("/budgets", { budget });
}

export function editBudget(id, budget) {
  return api.put(`/budgets/${id}`, { budget });
}

export function deleteBudget(id) {
  return api.delete(`/budgets/${id}`);
}

/** Activates/deactivates a budget. Activating one deactivates every other budget for the same factory. */
export function setBudgetStatus(id, status) {
  return api.patch(`/budgets/${id}/status`, { status });
}
