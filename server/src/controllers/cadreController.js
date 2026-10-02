"use strict";

const asyncHandler = require("../utils/asyncHandler");
const cadreService = require("../services/cadreService");

// GET /api/cadre/weekly?factoryId=&weekId=
const getWeeklyView = asyncHandler(async (req, res) => {
  const rows = await cadreService.getWeeklyCadreView(req.filters);
  res.json({ success: true, data: rows });
});

// GET /api/cadre/weekly-report?from=&to=&factoryId= (Weekly Data View's "Download Excel 2")
const getWeeklyReport = asyncHandler(async (req, res) => {
  const rows = await cadreService.getWeeklyStatusReport(req.filters);
  res.json({ success: true, data: rows });
});

module.exports = { getWeeklyView, getWeeklyReport };
