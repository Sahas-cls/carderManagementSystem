"use strict";

const asyncHandler = require("../utils/asyncHandler");
const weekService = require("../services/weekService");

const getWeeks = asyncHandler(async (req, res) => {
  const weeks = await weekService.getAllWeeks();
  res.json({ success: true, data: weeks });
});

const createWeek = asyncHandler(async (req, res) => {
  const week = await weekService.createWeek(req.body, req.user?.id);
  res.status(201).json({ success: true, data: week });
});

const updateWeek = asyncHandler(async (req, res) => {
  const week = await weekService.updateWeek(req.params.id, req.body);
  res.json({ success: true, data: week });
});

module.exports = { getWeeks, createWeek, updateWeek };
