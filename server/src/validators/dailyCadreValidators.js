"use strict";

const ApiError = require("../utils/ApiError");
const { parseOptionalId, parseRequiredId } = require("./cadreValidators");

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const BATCH_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// All the raw editable inputs the Daily Data Entry form submits; every
// derived MO/TMO/total is (re)computed server-side, never trusted from the
// client (see dailyCadreService.computeDerived). plannedMO/plannedTMO are
// deliberately NOT here - they mirror Budget Master (disabled fields on the
// form, the user never types them), so the server resolves them itself from
// whichever Budget is active for the factory (see resolvePlannedCounts) and
// anything the client sends for them is dropped here, before it ever reaches
// the service.
const NUMERIC_FIELDS = [
  "allocActualMO",
  "allocActualTMO",
  "newRecMO",
  "newRecTMO",
  "resignedMO",
  "resignedTMO",
  "absentMO",
  "absentTMO",
  "tcPlanned",
  "tcAllocated",
  "tcRecruit",
  "tcResigned",
  "tcTransfer",
  "tcActual",
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

module.exports = { validateDailyRecordBody, validateBatchIdParam, validateDailyRecordQuery };
