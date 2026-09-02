"use strict";

const { Router } = require("express");
const {
  getBudgets,
  createBudget,
  updateBudget,
  deleteBudget,
  setBudgetStatus,
} = require("../controllers/budgetController");
const {
  validateIdParam,
  validateFactoryQuery,
  validateBudgetBody,
  validateStatusBody,
} = require("../validators/budgetValidators");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = Router();

// Reading budgets is open to any signed-in user - Daily Data Entry uses the active
// budget to auto-fill Planned MO/TMO for whichever factory the user is entering for.
router.get("/", requireAuth, validateFactoryQuery, getBudgets);

// Managing budgets (Budget Master) is admin-only.
router.use(requireAuth, requireRole("Administrator"));

router.post("/", validateBudgetBody, createBudget);
router.put("/:id", validateIdParam, validateBudgetBody, updateBudget);
router.delete("/:id", validateIdParam, deleteBudget);
router.patch("/:id/status", validateIdParam, validateStatusBody, setBudgetStatus);

module.exports = router;
