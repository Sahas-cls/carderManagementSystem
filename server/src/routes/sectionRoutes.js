"use strict";

const { Router } = require("express");
const {
  getSections,
  createSection,
  updateSection,
  deleteSection,
} = require("../controllers/sectionController");
const { validateIdParam, validateSectionBody } = require("../validators/sectionValidators");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = Router();

router.get("/", getSections);

// Managing sections (Section Master) is admin-only.
router.use(requireAuth, requireRole("Administrator"));

router.post("/", validateSectionBody, createSection);
router.put("/:id", validateIdParam, validateSectionBody, updateSection);
router.delete("/:id", validateIdParam, deleteSection);

module.exports = router;
