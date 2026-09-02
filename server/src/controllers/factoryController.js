"use strict";

const asyncHandler = require("../utils/asyncHandler");
const factoryService = require("../services/factoryService");

const getFactories = asyncHandler(async (req, res) => {
  const factories = await factoryService.getAllFactories();
  res.json({ success: true, data: factories });
});

const createFactory = asyncHandler(async (req, res) => {
  const factory = await factoryService.createFactory(req.body, req.user?.id);
  res.status(201).json({ success: true, data: factory });
});

const updateFactory = asyncHandler(async (req, res) => {
  const factory = await factoryService.updateFactory(req.params.id, req.body);
  res.json({ success: true, data: factory });
});

const deleteFactory = asyncHandler(async (req, res) => {
  await factoryService.deleteFactory(req.params.id);
  res.json({ success: true, data: { id: req.params.id } });
});

module.exports = { getFactories, createFactory, updateFactory, deleteFactory };
