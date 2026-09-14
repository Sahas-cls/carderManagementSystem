"use strict";

const ApiError = require("../utils/ApiError");
const { parseOptionalId, parseRequiredId } = require("./cadreValidators");

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

/** Validates the :id route param used by the update/delete routes on the Employee Master page. */
function validateIdParam(req, res, next) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return next(new ApiError(400, "id must be a positive integer."));
  }
  req.params.id = id;
  next();
}

/** Validates the Employee Master list query: ?search= (partial EPF match) and an optional ?limit= for the "recently added" view. */
function validateEmployeeListQuery(req, res, next) {
  try {
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    req.filters = {
      search,
      limit: parseOptionalId(req.query.limit, "limit"),
    };
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Validates the create/update body for the Employee Master page. The client
 * sends { employee: { ... } } (or a flat body) - accept either and normalize
 * to the flat shape the service expects. batchId/isMo are intentionally not
 * accepted here - those are only ever set by the Daily Data Entry "Resigned
 * Employees" flow (see dailyCadreService.syncResignedEmployees).
 */
function validateEmployeeBody(req, res, next) {
  try {
    const source = req.body?.employee ?? req.body ?? {};

    const epf = typeof source.epf === "string" ? source.epf.trim() : "";
    const employeeName = typeof source.employeeName === "string" ? source.employeeName.trim() : "";
    const designationId = parseRequiredId(source.designationId, "designationId");
    const departmentId = parseRequiredId(source.departmentId, "departmentId");
    const sectionId = parseRequiredId(source.sectionId, "sectionId");
    const dateOfJoin = typeof source.dateOfJoin === "string" ? source.dateOfJoin.trim() : "";
    const dateOfResign =
      typeof source.dateOfResign === "string" && source.dateOfResign.trim() ? source.dateOfResign.trim() : null;
    const resignationReasonId =
      source.resignationReasonId === undefined || source.resignationReasonId === null || source.resignationReasonId === ""
        ? null
        : parseRequiredId(source.resignationReasonId, "resignationReasonId");

    if (!epf) throw new ApiError(400, "EPF Number is required.");
    if (!employeeName) throw new ApiError(400, "Employee Name is required.");
    if (!dateOfJoin) throw new ApiError(400, "Date of Join is required.");
    if (dateOfResign && dateOfResign < dateOfJoin) {
      throw new ApiError(400, "Date of Resign cannot be before Date of Join.");
    }

    req.body = { epf, employeeName, designationId, departmentId, sectionId, dateOfJoin, dateOfResign, resignationReasonId };
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  validateYearFactoryQuery,
  validateIdParam,
  validateEmployeeListQuery,
  validateEmployeeBody,
};
