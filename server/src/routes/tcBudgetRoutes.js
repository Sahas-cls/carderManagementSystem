"use strict";

const { Router } = require("express");
const {
  getTcBudgets,
  createTcBudget,
  updateTcBudget,
  deleteTcBudget,
  setTcBudgetStatus,
} = require("../controllers/tcBudgetController");
const {
  validateIdParam,
  validateFactoryQuery,
  validateTcBudgetBody,
  validateStatusBody,
} = require("../validators/tcBudgetValidators");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = Router();

// Reading TC budgets is open to any signed-in user - Daily Data Entry uses the active
// TC budget to auto-fill Training Center's Planned for whichever factory the user is entering for.
router.get("/", requireAuth, validateFactoryQuery, getTcBudgets);

// Managing TC budgets (Budget Master) is admin-only.
router.use(requireAuth, requireRole("Administrator"));

router.post("/", validateTcBudgetBody, createTcBudget);
router.put("/:id", validateIdParam, validateTcBudgetBody, updateTcBudget);
router.delete("/:id", validateIdParam, deleteTcBudget);
router.patch("/:id/status", validateIdParam, validateStatusBody, setTcBudgetStatus);

module.exports = router;
