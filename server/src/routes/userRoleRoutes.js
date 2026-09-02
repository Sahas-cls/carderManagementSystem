"use strict";

const { Router } = require("express");
const { getUserRoles } = require("../controllers/userRoleController");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = Router();

// Admin-only, same as /users - it only exists to populate the role dropdown
// on the Manage Users screen.
router.get("/", requireAuth, requireRole("Administrator"), getUserRoles);

module.exports = router;
