"use strict";

const { Router } = require("express");
const { getWeeks, createWeek, updateWeek } = require("../controllers/weekController");
const { validateWeekBody, validateWeekIdParam } = require("../validators/weekValidators");
const { requireAuth } = require("../middleware/auth");

const router = Router();

router.get("/", getWeeks);

// Creating/editing weeks needs to know who did it, so req.user has to be populated.
router.use(requireAuth);

router.post("/", validateWeekBody, createWeek);
router.put("/:id", validateWeekIdParam, validateWeekBody, updateWeek);

module.exports = router;
