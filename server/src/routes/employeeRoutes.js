"use strict";

const { Router } = require("express");
const {
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
router.get("/civil-status-analysis", validateYearFactoryQuery, getCivilStatusAnalysis);
router.get("/section-analysis", validateYearFactoryQuery, getSectionAnalysis);
router.get("/age-analysis", validateYearFactoryQuery, getAgeAnalysis);

// Not factory-scoped (an unlinked employee has no entry, so no factory) - same audience as the Daily Records factory filter.
router.get(
  "/unlinked-resigned",
  requireAuth,
  requireRole("Administrator", "SuperUser"),
  getUnlinkedResignedEmployees,
);

// TEMPORARY: lets the "User" role view every employee and edit existing
// ones (never add/delete) on Manage Employees, so they can fill in the
// Date of Birth / Civil Status / Gender data missing on older records. Set
// to false once that data is complete - and flip the matching flag in
// client/src/config/featureFlags.js too, which only hides the UI.
const ALLOW_USER_EMPLOYEE_EDITING = true;
const userRole = ALLOW_USER_EMPLOYEE_EDITING ? ["User"] : [];

// Manage Employees (Employee Master) - viewing is Administrator/SuperUser
// (+ User, see above), editing is Administrator (+ User), add/delete is
// Administrator only.
router.get(
  "/",
  requireAuth,
  requireRole("Administrator", "SuperUser", ...userRole),
  validateEmployeeListQuery,
  getEmployees,
);

router.put(
  "/:id",
  requireAuth,
  requireRole("Administrator", ...userRole),
  validateIdParam,
  validateEmployeeBody,
  updateEmployee,
);

router.use(requireAuth, requireRole("Administrator"));

router.post("/", validateEmployeeBody, createEmployee);
router.delete("/:id", validateIdParam, deleteEmployee);

module.exports = router;
