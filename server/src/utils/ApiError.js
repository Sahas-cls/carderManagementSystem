"use strict";

/** Thrown by services/controllers for expected failure cases (bad input, not found, ...). */
class ApiError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
  }
}

module.exports = ApiError;
