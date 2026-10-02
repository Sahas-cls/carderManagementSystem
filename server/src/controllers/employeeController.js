"use strict";

const asyncHandler = require("../utils/asyncHandler");
const employeeService = require("../services/employeeService");

// GET /api/employees/service-length-analysis?year=&factoryId=
const getServiceLengthAnalysis = asyncHandler(async (req, res) => {
  const analysis = await employeeService.getServiceLengthAnalysis(req.filters);
  res.json({ success: true, data: analysis });
});

// GET /api/employees/reason-analysis?year=&factoryId=
const getReasonAnalysis = asyncHandler(async (req, res) => {
  const analysis = await employeeService.getReasonAnalysis(req.filters);
  res.json({ success: true, data: analysis });
});

// GET /api/employees/civil-status-analysis?year=&factoryId=
const getCivilStatusAnalysis = asyncHandler(async (req, res) => {
  const analysis = await employeeService.getCivilStatusAnalysis(req.filters);
  res.json({ success: true, data: analysis });
});

// GET /api/employees/section-analysis?year=&factoryId=
const getSectionAnalysis = asyncHandler(async (req, res) => {
  const analysis = await employeeService.getSectionAnalysis(req.filters);
  res.json({ success: true, data: analysis });
});

// GET /api/employees/age-analysis?year=&factoryId=
const getAgeAnalysis = asyncHandler(async (req, res) => {
  const analysis = await employeeService.getAgeAnalysis(req.filters);
  res.json({ success: true, data: analysis });
});

// GET /api/employees/unlinked-resigned (Daily Entry page's Unlinked Employees list)
const getUnlinkedResignedEmployees = asyncHandler(async (req, res) => {
  const employees = await employeeService.listUnlinkedResignedEmployees();
  res.json({ success: true, data: employees });
});

/**
 * The User role only ever sees/edits its own factory's employees on Manage
 * Employees - returns that factory id (null if none is assigned, which
 * matches no employees). Administrator/SuperUser get undefined: no scoping.
 */
function scopedFactoryId(user) {
  if (user?.role?.userRole?.toLowerCase() !== "user") return undefined;
  return user.factory?.id ?? null;
}

// GET /api/employees?search=&page=&pageSize= (Manage Employees page) - returns { rows, total, page, pageSize }
const getEmployees = asyncHandler(async (req, res) => {
  // The User role is pinned to its own factory; everyone else may pick one
  // via ?factoryId= (or leave it off for every factory).
  const pinnedFactoryId = scopedFactoryId(req.user);
  const employees = await employeeService.listEmployees({
    ...req.filters,
    factoryId: pinnedFactoryId !== undefined ? pinnedFactoryId : req.filters.factoryId,
  });
  res.json({ success: true, data: employees });
});

const createEmployee = asyncHandler(async (req, res) => {
  const employee = await employeeService.createEmployeeRecord(req.body);
  res.status(201).json({ success: true, data: employee });
});

const updateEmployee = asyncHandler(async (req, res) => {
  const employee = await employeeService.updateEmployeeRecord(req.params.id, req.body, {
    factoryId: scopedFactoryId(req.user),
  });
  res.json({ success: true, data: employee });
});

const deleteEmployee = asyncHandler(async (req, res) => {
  await employeeService.deleteEmployeeRecord(req.params.id);
  res.json({ success: true, data: { id: req.params.id } });
});

module.exports = {
  getServiceLengthAnalysis,
  getReasonAnalysis,
  getCivilStatusAnalysis,
  getSectionAnalysis,
  getAgeAnalysis,
  getUnlinkedResignedEmployees,
  getEmployees,
  createEmployee,
  updateEmployee,
  deleteEmployee,
};
