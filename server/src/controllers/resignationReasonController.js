"use strict";

const asyncHandler = require("../utils/asyncHandler");
const resignationReasonService = require("../services/resignationReasonService");

const getResignationReasons = asyncHandler(async (req, res) => {
  const reasons = await resignationReasonService.getAllResignationReasons();
  res.json({ success: true, data: reasons });
});

const createResignationReason = asyncHandler(async (req, res) => {
  const reason = await resignationReasonService.createResignationReason(req.body);
  res.status(201).json({ success: true, data: reason });
});

const updateResignationReason = asyncHandler(async (req, res) => {
  const reason = await resignationReasonService.updateResignationReason(req.params.id, req.body);
  res.json({ success: true, data: reason });
});

const deleteResignationReason = asyncHandler(async (req, res) => {
  await resignationReasonService.deleteResignationReason(req.params.id);
  res.json({ success: true, data: { id: req.params.id } });
});

module.exports = {
  getResignationReasons,
  createResignationReason,
  updateResignationReason,
  deleteResignationReason,
};
