"use strict";

const asyncHandler = require("../utils/asyncHandler");
const designationService = require("../services/designationService");

const getDesignations = asyncHandler(async (req, res) => {
  const designations = await designationService.getAllDesignations();
  res.json({ success: true, data: designations });
});

const createDesignation = asyncHandler(async (req, res) => {
  const designation = await designationService.createDesignation(req.body);
  res.status(201).json({ success: true, data: designation });
});

const updateDesignation = asyncHandler(async (req, res) => {
  const designation = await designationService.updateDesignation(req.params.id, req.body);
  res.json({ success: true, data: designation });
});

const deleteDesignation = asyncHandler(async (req, res) => {
  await designationService.deleteDesignation(req.params.id);
  res.json({ success: true, data: { id: req.params.id } });
});

module.exports = { getDesignations, createDesignation, updateDesignation, deleteDesignation };
