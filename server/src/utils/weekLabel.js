"use strict";

/** Formats a Week's DATEONLY value ("YYYY-MM-DD") without shifting timezones. */
function formatWeekLabel(dateOnly) {
  if (!dateOnly) return "Unknown Week";
  const [year, month, day] = dateOnly.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return `Week of ${date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  })}`;
}

/** Adds `days` (may be negative) to a "YYYY-MM-DD" date string, returning a new "YYYY-MM-DD" string. */
function addDays(dateOnly, days) {
  const [year, month, day] = dateOnly.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

module.exports = { formatWeekLabel, addDays };
