"use strict";

const ApiError = require("../utils/ApiError");
const { parseOptionalId, parseRequiredId } = require("./cadreValidators");

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const BATCH_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Required fields for one row of the Resigned Employee popup (see
// CadreDetailsCard.jsx's ResignedEmployeesModal) - Service Period isn't here,
// it's derived from dateOfJoin/dateOfResign, never stored/trusted from the client.
const RESIGNED_EMPLOYEE_FIELDS = [
  "epf",
  "employeeName",
  "designationId",
  "departmentId",
  "sectionId",
  "dateOfJoin",
  "dateOfResign",
  "resignationReasonId",
];

/**
 * Validates the resigned-employee rows the popup collected. Required
 * whenever resignedMO + resignedTMO > 0 - the user cannot submit the Daily
 * Data Entry without one fully-filled row per resigned MO/TMO, matching the
 * popup's own gating. The first `rmo` rows are tagged isMo:true (MO), the
 * rest isMo:false (TMO) - mirrors how ResignedEmployeesModal orders them.
 */
function validateResignedEmployees(body, rmo, rtmo) {
  const total = rmo + rtmo;
  const rows = Array.isArray(body.resignedEmployees) ? body.resignedEmployees : [];

  if (total === 0) return [];

  if (rows.length !== total) {
    throw new ApiError(
      400,
      `Please provide details for all ${total} resigned employee(s) (Resigned/Terminated MO+TMO).`
    );
  }

  return rows.map((row, i) => {
    const parsed = {};
    RESIGNED_EMPLOYEE_FIELDS.forEach((field) => {
      const value = row?.[field];
      if (value === undefined || value === null || value === "") {
        throw new ApiError(400, `Resigned employee #${i + 1}: ${field} is required.`);
      }
      parsed[field] = value;
    });

    ["designationId", "departmentId", "sectionId", "resignationReasonId"].forEach((field) => {
      const num = Number(parsed[field]);
      if (!Number.isInteger(num) || num <= 0) {
        throw new ApiError(400, `Resigned employee #${i + 1}: ${field} must be a valid id.`);
      }
      parsed[field] = num;
    });

    if (!DATE_RE.test(parsed.dateOfJoin) || !DATE_RE.test(parsed.dateOfResign)) {
      throw new ApiError(400, `Resigned employee #${i + 1}: dates must be in YYYY-MM-DD format.`);
    }
    if (parsed.dateOfResign < parsed.dateOfJoin) {
      throw new ApiError(400, `Resigned employee #${i + 1}: Date of Resign cannot be before Date of Joining.`);
    }

    parsed.epf = String(parsed.epf).trim();
    parsed.employeeName = String(parsed.employeeName).trim();
    parsed.isMo = i < rmo;
    return parsed;
  });
}

// All the raw editable inputs the Daily Data Entry form submits; every
// derived MO/TMO/total is (re)computed server-side, never trusted from the
// client (see dailyCadreService.computeDerived). plannedMO/plannedTMO are
// deliberately NOT here for the same reason - they mirror Budget Master
// (disabled fields on the form, the user never types them), so the server
// resolves them itself from whichever Budget is active for the factory (see
// resolvePlannedCounts). tcPlanned mirrors TC Budget Master the same way
// (disabled field, see resolveTcPlanned) so it's also left out. tcActual
// (Training Center Actual Allocated) is also deliberately NOT here - it's
// derived from tcAllocated + tcRecruit - (tcResigned + tcTransfer), never
// typed in or trusted from the client.
const NUMERIC_FIELDS = [
  "allocActualMO",
  "allocActualTMO",
  "newRecMO",
  "newRecTMO",
  "resignedMO",
  "resignedTMO",
  "absentMO",
  "absentTMO",
  "tcAllocated",
  "tcRecruit",
  "tcResigned",
  "tcTransfer",
  "tcAbsent",
  "transferMO",
  "transferTMO",
];

/** Validates the create/update body. A field left out of the request stays out of req.body (see the allocActual "was it entered?" check in the service). */
function validateDailyRecordBody(req, res, next) {
  try {
    const body = req.body || {};
    const parsed = {
      factoryId: parseRequiredId(body.factoryId, "factoryId"),
    };

    if (typeof body.date !== "string" || !DATE_RE.test(body.date)) {
      throw new ApiError(400, "date must be a valid date in YYYY-MM-DD format.");
    }
    parsed.date = body.date;

    NUMERIC_FIELDS.forEach((field) => {
      if (body[field] === undefined || body[field] === null || body[field] === "") return;
      const num = Number(body[field]);
      if (!Number.isFinite(num) || num < 0) {
        throw new ApiError(400, `${field} must be a non-negative number.`);
      }
      parsed[field] = num;
    });

    parsed.resignedEmployees = validateResignedEmployees(
      body,
      parsed.resignedMO || 0,
      parsed.resignedTMO || 0
    );

    req.body = parsed;
    next();
  } catch (err) {
    next(err);
  }
}

function validateBatchIdParam(req, res, next) {
  if (typeof req.params.batchId !== "string" || !BATCH_ID_RE.test(req.params.batchId)) {
    return next(new ApiError(400, "batchId must be a valid record id."));
  }
  next();
}

function validateDailyRecordQuery(req, res, next) {
  try {
    const { year, month } = req.query;
    const parsed = {
      factoryId: parseOptionalId(req.query.factoryId, "factoryId"),
    };
    if (year !== undefined) {
      const y = Number(year);
      if (!Number.isInteger(y) || y < 2000) throw new ApiError(400, "year must be a valid year.");
      parsed.year = y;
    }
    if (month !== undefined) {
      const m = Number(month);
      if (!Number.isInteger(m) || m < 1 || m > 12) throw new ApiError(400, "month must be 1-12.");
      parsed.month = m;
    }
    req.filters = parsed;
    next();
  } catch (err) {
    next(err);
  }
}

/** Validates GET /daily/previous's factoryId + date query (both required - see dailyCadreService.getPreviousDailyRecord). */
function validatePreviousRecordQuery(req, res, next) {
  try {
    const { date } = req.query;
    if (typeof date !== "string" || !DATE_RE.test(date)) {
      throw new ApiError(400, "date must be a valid date in YYYY-MM-DD format.");
    }
    req.filters = {
      factoryId: parseRequiredId(req.query.factoryId, "factoryId"),
      beforeDate: date,
    };
    next();
  } catch (err) {
    next(err);
  }
}

/** Validates the optional year/factoryId filters used by the Cadre Trend view. */
function validateCadreTrendQuery(req, res, next) {
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

module.exports = {
  validateDailyRecordBody,
  validateBatchIdParam,
  validateDailyRecordQuery,
  validateCadreTrendQuery,
  validatePreviousRecordQuery,
};
