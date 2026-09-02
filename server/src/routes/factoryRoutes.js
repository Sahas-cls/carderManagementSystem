"use strict";

const { Router } = require("express");
const {
  getFactories,
  createFactory,
  updateFactory,
  deleteFactory,
} = require("../controllers/factoryController");
const { validateIdParam, validateFactoryBody } = require("../validators/factoryValidators");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = Router();

router.get("/", getFactories);

// Managing factories is an admin-only action (matches the client's /factory-master gating).
router.use(requireAuth, requireRole("Administrator"));

router.post("/", validateFactoryBody, createFactory);
router.put("/:id", validateIdParam, validateFactoryBody, updateFactory);
router.delete("/:id", validateIdParam, deleteFactory);

module.exports = router;
