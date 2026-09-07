"use strict";

const ApiError = require("../utils/ApiError");
const { parseOptionalId } = require("./cadreValidators");

/** Validates the optional factoryId/year filters shared by every LTO analysis endpoint (by length of service, by reason). */
function validateYearFactoryQuery(req, res, next) {
  try {
    const { year } = req.query;
    const parsed = {
      factoryId: parseOptionalId(req.query.factoryId, "factoryId"),
    };
    if (year !== undefined) {
      const y = Number(year);
      if (!Number.isInteger(y) || y < 2000) throw new ApiError(400, "year must be a valid year.");
      parsed.year = y;
    }
    req.filters = parsed;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { validateYearFactoryQuery };
