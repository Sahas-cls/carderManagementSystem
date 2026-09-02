"use strict";

const ApiError = require("../utils/ApiError");
const { parseOptionalId } = require("./cadreValidators");

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Validates the { week: "YYYY-MM-DD" } body used by create/update. */
function validateWeekBody(req, res, next) {
  try {
    const { week } = req.body || {};
    if (typeof week !== "string" || !DATE_ONLY.test(week) || Number.isNaN(Date.parse(week))) {
      throw new ApiError(400, "week must be a valid date in YYYY-MM-DD format.");
    }
    req.body = { week };
    next();
  } catch (err) {
    next(err);
  }
}

/** Validates the :id route param used by the update route. */
function validateWeekIdParam(req, res, next) {
  try {
    const id = parseOptionalId(req.params.id, "id");
    if (!id) throw new ApiError(400, "id must be a positive integer.");
    req.params.id = id;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { validateWeekBody, validateWeekIdParam };
