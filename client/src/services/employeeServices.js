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
export function getReasonAnalysis({ factoryId, year, month } = {}) {
  const params = {};
  if (factoryId) params.factoryId = factoryId;
  if (year) params.year = year;
  if (month) params.month = month;
  return api.get("/employees/reason-analysis", { params });
}

/**
 * This year's resigned employees, grouped by civil status (Married /
 * Unmarried, plus "Not Recorded" for rows without one). Optionally scoped to
 * one factory. Backs the dashboard's "LTO by Civil Status" donut chart.
 */
export function getCivilStatusAnalysis({ factoryId, year, month } = {}) {
  const params = {};
  if (factoryId) params.factoryId = factoryId;
  if (year) params.year = year;
  if (month) params.month = month;
  return api.get("/employees/civil-status-analysis", { params });
}

/**
 * This year's resigned employees, grouped by section (top sections named
 * individually, the rest folded into "Other" - see employeeService.js's
 * getSectionAnalysis). Optionally scoped to one factory. Backs the
 * dashboard's "LTO by Section" donut chart.
 */
export function getSectionAnalysis({ factoryId, year, month } = {}) {
  const params = {};
  if (factoryId) params.factoryId = factoryId;
  if (year) params.year = year;
  if (month) params.month = month;
  return api.get("/employees/section-analysis", { params });
}

/**
 * This year's resigned employees, grouped by age at resignation (Date of
 * Resign - Date of Birth) into fixed bands, plus "Not Recorded" for rows
 * without a Date of Birth. Optionally scoped to one factory. Backs the
 * dashboard's "LTO by Age" donut chart.
 */
export function getAgeAnalysis({ factoryId, year, month } = {}) {
  const params = {};
  if (factoryId) params.factoryId = factoryId;
  if (year) params.year = year;
  if (month) params.month = month;
  return api.get("/employees/age-analysis", { params });
}

/** Employees with a Date of Resign but no linked Daily Data Entry (entry deleted, or trimmed off it). */
export function getUnlinkedResignedEmployees() {
  return api.get("/employees/unlinked-resigned");
}

/** No `search` -> the 10 (or `limit`) most recently added employees. With `search`, employees whose EPF number contains it. */
/** One page of employees (optionally EPF-filtered) - resolves to { rows, total, page, pageSize }. */
export function getEmployees({ search, factoryId, page, pageSize } = {}) {
  const params = {};
  if (search) params.search = search;
  if (factoryId) params.factoryId = factoryId;
  if (page) params.page = page;
  if (pageSize) params.pageSize = pageSize;
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
