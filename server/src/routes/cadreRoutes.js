"use strict";

const { Router } = require("express");
const { getWeeklyView } = require("../controllers/cadreController");
const {
  getDailyRecords,
  createDailyRecord,
  updateDailyRecord,
  deleteDailyRecord,
  getCadreTrend,
  getPreviousDailyRecord,
} = require("../controllers/dailyCadreController");
const { validateWeeklyQuery } = require("../validators/cadreValidators");
const {
  validateDailyRecordBody,
  validateBatchIdParam,
  validateDailyRecordQuery,
  validateCadreTrendQuery,
  validatePreviousRecordQuery,
} = require("../validators/dailyCadreValidators");

const router = Router();

router.get("/weekly", validateWeeklyQuery, getWeeklyView);

// Must come before "/daily" so "previous" isn't swallowed by that route -
// it's a static segment, not a param, so ordering only matters relative to
// any future "/daily/:something" GET route.
router.get("/daily/previous", validatePreviousRecordQuery, getPreviousDailyRecord);
router.get("/daily", validateDailyRecordQuery, getDailyRecords);
router.post("/daily", validateDailyRecordBody, createDailyRecord);
router.put("/daily/:batchId", validateBatchIdParam, validateDailyRecordBody, updateDailyRecord);
router.delete("/daily/:batchId", validateBatchIdParam, deleteDailyRecord);

router.get("/trend", validateCadreTrendQuery, getCadreTrend);

module.exports = router;
