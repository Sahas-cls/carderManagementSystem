"use strict";

const asyncHandler = require("../utils/asyncHandler");
const serviceRangeService = require("../services/serviceRangeService");

const getServiceRanges = asyncHandler(async (req, res) => {
  const ranges = await serviceRangeService.getAllServiceRanges();
  res.json({ success: true, data: ranges });
});

const createServiceRange = asyncHandler(async (req, res) => {
  const range = await serviceRangeService.createServiceRange(req.body);
  res.status(201).json({ success: true, data: range });
});

const updateServiceRange = asyncHandler(async (req, res) => {
  const range = await serviceRangeService.updateServiceRange(req.params.id, req.body);
  res.json({ success: true, data: range });
});

const deleteServiceRange = asyncHandler(async (req, res) => {
  await serviceRangeService.deleteServiceRange(req.params.id);
  res.json({ success: true, data: { id: req.params.id } });
});

module.exports = { getServiceRanges, createServiceRange, updateServiceRange, deleteServiceRange };
