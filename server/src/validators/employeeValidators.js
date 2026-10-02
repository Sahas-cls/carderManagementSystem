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
    // Optional - narrows the LTO breakdowns to one calendar month of `year`
    // (the dashboard's Month filter); ignored by the year-only analyses.
    if (req.query.month !== undefined) {
      const m = Number(req.query.month);
      if (!Number.isInteger(m) || m < 1 || m > 12) throw new ApiError(400, "month must be 1-12.");
      parsed.month = m;
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

const MAX_PAGE_SIZE = 100;

/**
 * Validates the Employee Master list query: ?search= (partial EPF match),
 * ?factoryId= (Administrator/SuperUser's factory filter - the User role is
 * always pinned to its own factory instead, see employeeController),
 * ?page= (1-based) and ?pageSize= (capped at MAX_PAGE_SIZE).
 */
function validateEmployeeListQuery(req, res, next) {
  try {
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const pageSize = parseOptionalId(req.query.pageSize, "pageSize");
    req.filters = {
      search,
      factoryId: parseOptionalId(req.query.factoryId, "factoryId") || undefined,
      page: parseOptionalId(req.query.page, "page") || 1,
      pageSize: pageSize ? Math.min(pageSize, MAX_PAGE_SIZE) : undefined,
    };
    next();
  } catch (err) {
    next(err);
  }
}

/** Trimmed string, or null when missing/blank - for the optional free-text fields below. */
function optionalString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
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

    // Optional - Civil Status / Gender are plain strings (no ENUM), the
    // page's dropdowns decide the values.
    const dateOfBirth = optionalString(source.dateOfBirth);
    const civilStatus = optionalString(source.civilStatus);
    const gender = optionalString(source.gender);
    if (dateOfBirth && !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
      throw new ApiError(400, "Date of Birth must be a valid date in YYYY-MM-DD format.");
    }
    if (dateOfBirth && dateOfBirth >= dateOfJoin) {
      throw new ApiError(400, "Date of Birth must be before Date of Join.");
    }

    req.body = {
      epf,
      employeeName,
      designationId,
      departmentId,
      sectionId,
      dateOfJoin,
      dateOfResign,
      resignationReasonId,
      dateOfBirth,
      civilStatus,
      gender,
    };
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
