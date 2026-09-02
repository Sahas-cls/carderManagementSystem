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
 * Validates the create/update body. The client sends { factory: { factoryCode,
 * factoryName } } - accept that shape (or a flat body) and normalize to the
 * flat shape the service expects.
 */
function validateFactoryBody(req, res, next) {
  try {
    const source = req.body?.factory ?? req.body ?? {};
    const factoryCode = typeof source.factoryCode === "string" ? source.factoryCode.trim() : "";
    const factoryName = typeof source.factoryName === "string" ? source.factoryName.trim() : "";

    if (!factoryCode) {
      throw new ApiError(400, "Factory Code is required.");
    }
    if (!factoryName) {
      throw new ApiError(400, "Factory Name is required.");
    }

    req.body = { factoryCode, factoryName };
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { validateIdParam, validateFactoryBody };
