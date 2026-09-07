"use strict";

const { Router } = require("express");
const {
  getResignationReasons,
  createResignationReason,
  updateResignationReason,
  deleteResignationReason,
} = require("../controllers/resignationReasonController");
const {
  validateIdParam,
  validateResignationReasonBody,
} = require("../validators/resignationReasonValidators");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = Router();

router.get("/", getResignationReasons);

// Managing resignation reasons (Reason Master) is admin-only.
router.use(requireAuth, requireRole("Administrator"));

router.post("/", validateResignationReasonBody, createResignationReason);
router.put("/:id", validateIdParam, validateResignationReasonBody, updateResignationReason);
router.delete("/:id", validateIdParam, deleteResignationReason);

module.exports = router;
