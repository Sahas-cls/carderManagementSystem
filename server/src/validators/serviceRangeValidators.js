"use strict";

const ApiError = require("../utils/ApiError");

/** Validates the :id route param used by the update/delete routes. */
function validateIdParam(req, res, next) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return next(new ApiError(400, "id must be a positive integer."));
  }
  req.params.id = id;
  next();
}

/** Parses a value the client may send as a number or numeric string; rejects anything else negative/non-numeric. */
function parseNonNegativeInt(value, label) {
  const num = Number(value);
  if (value === undefined || value === null || value === "" || !Number.isInteger(num) || num < 0) {
    throw new ApiError(400, `${label} must be a non-negative whole number.`);
  }
  return num;
}

/**
 * Validates the create/update body. The client sends { serviceRange: { years, months } } -
 * accept that shape (or a flat body) and normalize to the flat shape the service expects.
 */
function validateServiceRangeBody(req, res, next) {
  try {
    const source = req.body?.serviceRange ?? req.body ?? {};
    const years = parseNonNegativeInt(source.years, "Years");
    const months = parseNonNegativeInt(source.months, "Months");

    req.body = { years, months };
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { validateIdParam, validateServiceRangeBody };
