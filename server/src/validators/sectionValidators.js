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
 * Validates the create/update body. The client sends { section: { sectionName } } -
 * accept that shape (or a flat body) and normalize to the flat shape the service expects.
 */
function validateSectionBody(req, res, next) {
  try {
    const source = req.body?.section ?? req.body ?? {};
    const sectionName = typeof source.sectionName === "string" ? source.sectionName.trim() : "";

    if (!sectionName) {
      throw new ApiError(400, "Section Name is required.");
    }

    req.body = { sectionName };
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { validateIdParam, validateSectionBody };
