"use strict";

const { Router } = require("express");
const { getWeeklyView } = require("../controllers/cadreController");
const {
  getDailyRecords,
  createDailyRecord,
  updateDailyRecord,
  deleteDailyRecord,
} = require("../controllers/dailyCadreController");
const { validateWeeklyQuery } = require("../validators/cadreValidators");
const {
  validateDailyRecordBody,
  validateBatchIdParam,
  validateDailyRecordQuery,
} = require("../validators/dailyCadreValidators");

const router = Router();

router.get("/weekly", validateWeeklyQuery, getWeeklyView);

router.get("/daily", validateDailyRecordQuery, getDailyRecords);
router.post("/daily", validateDailyRecordBody, createDailyRecord);
router.put("/daily/:batchId", validateBatchIdParam, validateDailyRecordBody, updateDailyRecord);
router.delete("/daily/:batchId", validateBatchIdParam, deleteDailyRecord);

module.exports = router;
