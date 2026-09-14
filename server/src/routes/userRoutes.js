"use strict";

const { Router } = require("express");
const { getUsers, updateUser, setUserStatus, resetPassword, deleteUser } = require("../controllers/userController");
const { requireAuth, requireRole } = require("../middleware/auth");
const { validateIdParam, validateUpdateUserBody, validateStatusBody } = require("../validators/userValidators");

const router = Router();

// Everything here is admin-only.
router.use(requireAuth, requireRole("Administrator"));

router.get("/", getUsers);
router.patch("/:id", validateIdParam, validateUpdateUserBody, updateUser);
router.patch("/:id/status", validateIdParam, validateStatusBody, setUserStatus);
router.post("/:id/reset-password", validateIdParam, resetPassword);
router.delete("/:id", validateIdParam, deleteUser);

module.exports = router;
