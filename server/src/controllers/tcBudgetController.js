"use strict";

const asyncHandler = require("../utils/asyncHandler");
const tcBudgetService = require("../services/tcBudgetService");

// GET TC BUDGETS BY FACTORY (or every factory when no ?factoryId is given)
const getTcBudgets = asyncHandler(async (req, res) => {
  const tcBudgets = await tcBudgetService.getTcBudgets(req.query.factoryId);
  res.json({ success: true, data: tcBudgets });
});

// CREATE TC BUDGET
const createTcBudget = asyncHandler(async (req, res) => {
  const tcBudget = await tcBudgetService.createTcBudget(req.body, req.user?.id);
  res.status(201).json({ success: true, data: tcBudget });
});

// EDIT TC BUDGET
const updateTcBudget = asyncHandler(async (req, res) => {
  const tcBudget = await tcBudgetService.updateTcBudget(req.params.id, req.body);
  res.json({ success: true, data: tcBudget });
});

// DELETE TC BUDGET - SOFT DELETE
const deleteTcBudget = asyncHandler(async (req, res) => {
  await tcBudgetService.deleteTcBudget(req.params.id);
  res.json({ success: true, data: { id: req.params.id } });
});

// CHANGE CURRENTLY ACTIVE TC BUDGET - activating one deactivates every other TC budget for that factory
const setTcBudgetStatus = asyncHandler(async (req, res) => {
  const tcBudget = await tcBudgetService.setTcBudgetStatus(req.params.id, req.body.status);
  res.json({ success: true, data: tcBudget });
});

module.exports = { getTcBudgets, createTcBudget, updateTcBudget, deleteTcBudget, setTcBudgetStatus };
