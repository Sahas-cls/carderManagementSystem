"use strict";

const { Router } = require("express");
const {
  getDesignations,
  createDesignation,
  updateDesignation,
  deleteDesignation,
} = require("../controllers/designationController");
const { validateIdParam, validateDesignationBody } = require("../validators/designationValidators");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = Router();

router.get("/", getDesignations);

// Managing designations (Designation Master) is admin-only.
router.use(requireAuth, requireRole("Administrator"));

router.post("/", validateDesignationBody, createDesignation);
router.put("/:id", validateIdParam, validateDesignationBody, updateDesignation);
router.delete("/:id", validateIdParam, deleteDesignation);

module.exports = router;
