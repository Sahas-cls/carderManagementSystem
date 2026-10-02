"use strict";

const { Router } = require("express");
const { getWeeklyView, getWeeklyReport } = require("../controllers/cadreController");
const {
  getDailyRecords,
  createDailyRecord,
  updateDailyRecord,
  deleteDailyRecord,
  deleteResignedEmployee,
  rejoinResignedEmployee,
  getCadreTrend,
  getPreviousDailyRecord,
} = require("../controllers/dailyCadreController");
const { validateWeeklyQuery, validateWeeklyReportQuery } = require("../validators/cadreValidators");
const {
  validateDailyRecordBody,
  validateBatchIdParam,
  validateResignedEmployeeParams,
  validateRejoinBody,
  validateDailyRecordQuery,
  validateCadreTrendQuery,
  validatePreviousRecordQuery,
} = require("../validators/dailyCadreValidators");
const { requireAuth, forbidRole } = require("../middleware/auth");

const router = Router();

router.get("/weekly", validateWeeklyQuery, getWeeklyView);
router.get("/weekly-report", validateWeeklyReportQuery, getWeeklyReport);

// Must come before "/daily" so "previous" isn't swallowed by that route -
// it's a static segment, not a param, so ordering only matters relative to
// any future "/daily/:something" GET route.
router.get("/daily/previous", validatePreviousRecordQuery, getPreviousDailyRecord);
router.get("/daily", validateDailyRecordQuery, getDailyRecords);
router.get("/trend", validateCadreTrendQuery, getCadreTrend);

// Creating/editing/deleting Daily Data Entry records is view-only for SuperUser.
router.use(requireAuth, forbidRole("SuperUser"));

router.post("/daily", validateDailyRecordBody, createDailyRecord);
router.put("/daily/:batchId", validateBatchIdParam, validateDailyRecordBody, updateDailyRecord);
router.delete("/daily/:batchId/resigned/:epf", validateResignedEmployeeParams, deleteResignedEmployee);
router.patch(
  "/daily/:batchId/resigned/:epf/rejoin",
  validateResignedEmployeeParams,
  validateRejoinBody,
  rejoinResignedEmployee,
);
router.delete("/daily/:batchId", validateBatchIdParam, deleteDailyRecord);

module.exports = router;
