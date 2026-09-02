"use strict";

const ApiError = require("../utils/ApiError");

/** Parses an optional numeric id query/body value, throwing a 400 if it's present but invalid. */
function parseOptionalId(value, paramName) {
  if (value === undefined || value === null || value === "") return undefined;
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new ApiError(400, `${paramName} must be a positive integer.`);
  }
  return id;
}

/** Same as parseOptionalId, but the value must be present. */
function parseRequiredId(value, paramName) {
  const id = parseOptionalId(value, paramName);
  if (id === undefined) throw new ApiError(400, `${paramName} is required.`);
  return id;
}

/** Validates the optional factoryId/weekId filters used by the weekly cadre view. */
function validateWeeklyQuery(req, res, next) {
  try {
    req.filters = {
      factoryId: parseOptionalId(req.query.factoryId, "factoryId"),
      weekId: parseOptionalId(req.query.weekId, "weekId"),
    };
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  parseOptionalId,
  parseRequiredId,
  validateWeeklyQuery,
};
