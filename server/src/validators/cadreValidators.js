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

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Validates GET /cadre/weekly-report's ?from=&to= (both required, YYYY-MM-DD, from <= to) and optional ?factoryId=. */
function validateWeeklyReportQuery(req, res, next) {
  try {
    const { from, to } = req.query;
    if (typeof from !== "string" || !DATE_RE.test(from) || typeof to !== "string" || !DATE_RE.test(to)) {
      throw new ApiError(400, "from and to must be valid dates in YYYY-MM-DD format.");
    }
    if (from > to) throw new ApiError(400, "The From date cannot be after the To date.");
    req.filters = {
      from,
      to,
      factoryId: parseOptionalId(req.query.factoryId, "factoryId"),
    };
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  validateWeeklyReportQuery,
  parseOptionalId,
  parseRequiredId,
  validateWeeklyQuery,
};
