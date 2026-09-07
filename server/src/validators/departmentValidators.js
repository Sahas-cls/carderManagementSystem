"use strict";

const ApiError = require("../utils/ApiError");
const { parseOptionalId, parseRequiredId } = require("./cadreValidators");

/** Validates the :id route param used by the update/delete routes. */
function validateIdParam(req, res, next) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return next(new ApiError(400, "id must be a positive integer."));
  }
  req.params.id = id;
  next();
}

/** Validates the optional ?factoryId= filter used by the Resigned Employee popup's dropdown. */
function validateDepartmentQuery(req, res, next) {
  try {
    req.filters = { factoryId: parseOptionalId(req.query.factoryId, "factoryId") };
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Validates the create/update body. The client sends { department: { factoryId, departmentName } } -
 * accept that shape (or a flat body) and normalize to the flat shape the service expects.
 */
function validateDepartmentBody(req, res, next) {
  try {
    const source = req.body?.department ?? req.body ?? {};
    const departmentName = typeof source.departmentName === "string" ? source.departmentName.trim() : "";
    const factoryId = parseRequiredId(source.factoryId, "factoryId");

    if (!departmentName) {
      throw new ApiError(400, "Department Name is required.");
    }

    req.body = { factoryId, departmentName };
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { validateIdParam, validateDepartmentQuery, validateDepartmentBody };
