"use strict";

const asyncHandler = require("../utils/asyncHandler");
const departmentService = require("../services/departmentService");

// GET /api/departments?factoryId=
const getDepartments = asyncHandler(async (req, res) => {
  const departments = await departmentService.getAllDepartments(req.filters);
  res.json({ success: true, data: departments });
});

const createDepartment = asyncHandler(async (req, res) => {
  const department = await departmentService.createDepartment(req.body);
  res.status(201).json({ success: true, data: department });
});

const updateDepartment = asyncHandler(async (req, res) => {
  const department = await departmentService.updateDepartment(req.params.id, req.body);
  res.json({ success: true, data: department });
});

const deleteDepartment = asyncHandler(async (req, res) => {
  await departmentService.deleteDepartment(req.params.id);
  res.json({ success: true, data: { id: req.params.id } });
});

module.exports = { getDepartments, createDepartment, updateDepartment, deleteDepartment };
