"use strict";

const asyncHandler = require("../utils/asyncHandler");
const sectionService = require("../services/sectionService");

const getSections = asyncHandler(async (req, res) => {
  const sections = await sectionService.getAllSections();
  res.json({ success: true, data: sections });
});

const createSection = asyncHandler(async (req, res) => {
  const section = await sectionService.createSection(req.body);
  res.status(201).json({ success: true, data: section });
});

const updateSection = asyncHandler(async (req, res) => {
  const section = await sectionService.updateSection(req.params.id, req.body);
  res.json({ success: true, data: section });
});

const deleteSection = asyncHandler(async (req, res) => {
  await sectionService.deleteSection(req.params.id);
  res.json({ success: true, data: { id: req.params.id } });
});

module.exports = { getSections, createSection, updateSection, deleteSection };
