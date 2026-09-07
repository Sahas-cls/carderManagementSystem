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
