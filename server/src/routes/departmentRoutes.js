"use strict";

const { Router } = require("express");
const {
  getDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
} = require("../controllers/departmentController");
const {
  validateIdParam,
  validateDepartmentQuery,
  validateDepartmentBody,
} = require("../validators/departmentValidators");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = Router();

router.get("/", validateDepartmentQuery, getDepartments);

// Managing departments (Department Master) is admin-only.
router.use(requireAuth, requireRole("Administrator"));

router.post("/", validateDepartmentBody, createDepartment);
router.put("/:id", validateIdParam, validateDepartmentBody, updateDepartment);
router.delete("/:id", validateIdParam, deleteDepartment);

module.exports = router;
