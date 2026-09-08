"use strict";

const ApiError = require("../utils/ApiError");

/** Validates the :id route param used by the update/delete/status routes. */
function validateIdParam(req, res, next) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return next(new ApiError(400, "id must be a positive integer."));
  }
  req.params.id = id;
  next();
}

/** Validates the optional ?factoryId= query param used to scope GET /tc-budgets. */
function validateFactoryQuery(req, res, next) {
  const { factoryId } = req.query;
  if (factoryId === undefined || factoryId === "") {
    req.query.factoryId = undefined;
    return next();
  }
  const id = Number(factoryId);
  if (!Number.isInteger(id) || id <= 0) {
    return next(new ApiError(400, "factoryId must be a positive integer."));
  }
  req.query.factoryId = id;
  next();
}

/** Parses a value the client may send as a number or numeric string; rejects anything else negative/non-numeric. */
function parseCount(value, label) {
  const count = Number(value);
  if (value === undefined || value === null || value === "" || !Number.isFinite(count) || count < 0) {
    throw new ApiError(400, `${label} must be a non-negative number.`);
  }
  return count;
}

/**
 * Validates the create/update body. The client sends { tcBudget: { factoryId, planned } } -
 * accept that shape (or a flat body) and normalize to the flat shape the service expects.
 */
function validateTcBudgetBody(req, res, next) {
  try {
    const source = req.body?.tcBudget ?? req.body ?? {};
    const factoryId = Number(source.factoryId);
    if (!Number.isInteger(factoryId) || factoryId <= 0) {
      throw new ApiError(400, "Factory is required.");
    }

    const planned = parseCount(source.planned, "Planned");

    req.body = { factoryId, planned };
    next();
  } catch (err) {
    next(err);
  }
}

/** Validates the body of PATCH /tc-budgets/:id/status - accepts { status } or { tcBudget: { status } }. */
function validateStatusBody(req, res, next) {
  const source = req.body?.tcBudget ?? req.body ?? {};
  if (typeof source.status !== "boolean") {
    return next(new ApiError(400, "status must be a boolean."));
  }
  req.body = { status: source.status };
  next();
}

module.exports = { validateIdParam, validateFactoryQuery, validateTcBudgetBody, validateStatusBody };
