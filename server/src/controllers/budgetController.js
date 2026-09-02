"use strict";

const asyncHandler = require("../utils/asyncHandler");
const budgetService = require("../services/budgetService");

// GET BUDGETS BY FACTORY (or every factory when no ?factoryId is given)
const getBudgets = asyncHandler(async (req, res) => {
  const budgets = await budgetService.getBudgets(req.query.factoryId);
  res.json({ success: true, data: budgets });
});

// CREATE BUDGET
const createBudget = asyncHandler(async (req, res) => {
  const budget = await budgetService.createBudget(req.body, req.user?.id);
  res.status(201).json({ success: true, data: budget });
});

// EDIT BUDGET
const updateBudget = asyncHandler(async (req, res) => {
  const budget = await budgetService.updateBudget(req.params.id, req.body);
  res.json({ success: true, data: budget });
});

// DELETE BUDGET - SOFT DELETE
const deleteBudget = asyncHandler(async (req, res) => {
  await budgetService.deleteBudget(req.params.id);
  res.json({ success: true, data: { id: req.params.id } });
});

// CHANGE CURRENTLY ACTIVE BUDGET - activating one deactivates every other budget for that factory
const setBudgetStatus = asyncHandler(async (req, res) => {
  const budget = await budgetService.setBudgetStatus(req.params.id, req.body.status);
  res.json({ success: true, data: budget });
});

module.exports = { getBudgets, createBudget, updateBudget, deleteBudget, setBudgetStatus };
