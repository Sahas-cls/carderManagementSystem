"use strict";

const { Router } = require("express");
const {
  getServiceLengthAnalysis,
  getReasonAnalysis,
  getEmployees,
  createEmployee,
  updateEmployee,
  deleteEmployee,
} = require("../controllers/employeeController");
const {
  validateYearFactoryQuery,
  validateIdParam,
  validateEmployeeListQuery,
  validateEmployeeBody,
} = require("../validators/employeeValidators");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = Router();

router.get("/service-length-analysis", validateYearFactoryQuery, getServiceLengthAnalysis);
router.get("/reason-analysis", validateYearFactoryQuery, getReasonAnalysis);

// Manage Employees (Employee Master) - viewing and editing employee details is admin-only.
router.use(requireAuth, requireRole("Administrator"));

router.get("/", validateEmployeeListQuery, getEmployees);
router.post("/", validateEmployeeBody, createEmployee);
router.put("/:id", validateIdParam, validateEmployeeBody, updateEmployee);
router.delete("/:id", validateIdParam, deleteEmployee);

module.exports = router;
