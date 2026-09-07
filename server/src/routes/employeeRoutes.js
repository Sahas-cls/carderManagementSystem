"use strict";

const { Router } = require("express");
const { getServiceLengthAnalysis, getReasonAnalysis } = require("../controllers/employeeController");
const { validateYearFactoryQuery } = require("../validators/employeeValidators");

const router = Router();

router.get("/service-length-analysis", validateYearFactoryQuery, getServiceLengthAnalysis);
router.get("/reason-analysis", validateYearFactoryQuery, getReasonAnalysis);

module.exports = router;
