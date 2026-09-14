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

// GET /api/employees?search=&limit= (Manage Employees page)
const getEmployees = asyncHandler(async (req, res) => {
  const employees = await employeeService.listEmployees(req.filters);
  res.json({ success: true, data: employees });
});

const createEmployee = asyncHandler(async (req, res) => {
  const employee = await employeeService.createEmployeeRecord(req.body);
  res.status(201).json({ success: true, data: employee });
});

const updateEmployee = asyncHandler(async (req, res) => {
  const employee = await employeeService.updateEmployeeRecord(req.params.id, req.body);
  res.json({ success: true, data: employee });
});

const deleteEmployee = asyncHandler(async (req, res) => {
  await employeeService.deleteEmployeeRecord(req.params.id);
  res.json({ success: true, data: { id: req.params.id } });
});

module.exports = {
  getServiceLengthAnalysis,
  getReasonAnalysis,
  getEmployees,
  createEmployee,
  updateEmployee,
  deleteEmployee,
};
