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

module.exports = { getServiceLengthAnalysis, getReasonAnalysis };
