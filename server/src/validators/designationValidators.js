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

/**
 * Validates the create/update body. The client sends { designation: { designation } } -
 * accept that shape (or a flat body) and normalize to the flat shape the service expects.
 */
function validateDesignationBody(req, res, next) {
  try {
    const source = req.body?.designation ?? req.body ?? {};
    const designation = typeof source.designation === "string" ? source.designation.trim() : "";

    if (!designation) {
      throw new ApiError(400, "Designation is required.");
    }

    req.body = { designation };
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { validateIdParam, validateDesignationBody };
