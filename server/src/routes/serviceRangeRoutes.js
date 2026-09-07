"use strict";

const { Router } = require("express");
const {
  getServiceRanges,
  createServiceRange,
  updateServiceRange,
  deleteServiceRange,
} = require("../controllers/serviceRangeController");
const { validateIdParam, validateServiceRangeBody } = require("../validators/serviceRangeValidators");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = Router();

router.get("/", getServiceRanges);

// Managing service ranges (Service Range Master) is admin-only.
router.use(requireAuth, requireRole("Administrator"));

router.post("/", validateServiceRangeBody, createServiceRange);
router.put("/:id", validateIdParam, validateServiceRangeBody, updateServiceRange);
router.delete("/:id", validateIdParam, deleteServiceRange);

module.exports = router;
