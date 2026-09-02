"use strict";

const asyncHandler = require("../utils/asyncHandler");
const dailyCadreService = require("../services/dailyCadreService");

// GET /api/cadre/daily?year=&month=&factoryId=
const getDailyRecords = asyncHandler(async (req, res) => {
  const records = await dailyCadreService.listDailyRecords(req.filters);
  res.json({ success: true, data: records });
});

// POST /api/cadre/daily
const createDailyRecord = asyncHandler(async (req, res) => {
  const record = await dailyCadreService.createDailyRecord(req.body);
  res.status(201).json({ success: true, data: record });
});

// PUT /api/cadre/daily/:batchId
const updateDailyRecord = asyncHandler(async (req, res) => {
  const record = await dailyCadreService.updateDailyRecord(req.params.batchId, req.body);
  res.json({ success: true, data: record });
});

// DELETE /api/cadre/daily/:batchId
const deleteDailyRecord = asyncHandler(async (req, res) => {
  await dailyCadreService.deleteDailyRecord(req.params.batchId);
  res.json({ success: true, data: null });
});

module.exports = { getDailyRecords, createDailyRecord, updateDailyRecord, deleteDailyRecord };
