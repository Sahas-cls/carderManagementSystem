import api from "./api";

/**
 * This year's resigned employees, bucketed by length of service at
 * resignation (Manage Service Ranges' admin-configured cutoffs). Optionally
 * scoped to one factory. Backs the dashboard's "LTO by Length of Service"
 * donut chart.
 */
export function getServiceLengthAnalysis({ factoryId, year } = {}) {
  const params = {};
  if (factoryId) params.factoryId = factoryId;
  if (year) params.year = year;
  return api.get("/employees/service-length-analysis", { params });
}

/**
 * This year's resigned employees, grouped by resignation reason (top reasons
 * named individually, the rest folded into "Other" - see employeeService.js's
 * getReasonAnalysis). Optionally scoped to one factory. Backs the
 * dashboard's "LTO by Reason" pie chart.
 */
export function getReasonAnalysis({ factoryId, year } = {}) {
  const params = {};
  if (factoryId) params.factoryId = factoryId;
  if (year) params.year = year;
  return api.get("/employees/reason-analysis", { params });
}

/** No `search` -> the 10 (or `limit`) most recently added employees. With `search`, employees whose EPF number contains it. */
export function getEmployees({ search, limit } = {}) {
  const params = {};
  if (search) params.search = search;
  if (limit) params.limit = limit;
  return api.get("/employees", { params: Object.keys(params).length ? params : undefined });
}

export function createEmployee(employee) {
  return api.post("/employees", { employee });
}

export function editEmployee(id, employee) {
  return api.put(`/employees/${id}`, { employee });
}

export function deleteEmployee(id) {
  return api.delete(`/employees/${id}`);
}
