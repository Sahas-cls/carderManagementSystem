// Static option lists and week-date ranges for the Cadre Management module.
// Keeping these in one place makes it easy to add a new factory or week
// without touching any component code.

export const FACTORIES = [
  "Concord Apparel - Avissawella",
  "Concord Manufacturing - Thabuttegama",
  "Guston Lanka - Talawa",
  "MG Apparel - Imbulana",
];

export const WEEKS = [
  "1st Week_ 1st July 2026",
  "2nd Week_ 7th July 2026",
  "3rd Week_ 14th July 2026",
  "4th Week_ 21st July 2026",
  "5th Week_ 28th July 2026",
  "1st Week_ 5th August 2026",
  "2nd Week_ 12th August 2026",
  "3rd Week_ 19th August 2026",
  "4th Week_ 25th August 2026",
];

// [startDate, endDate, weekLabel] - used to auto-fill the Week No. field
// when a Date is picked on the Daily Data Entry form.
export const WEEK_RANGES = [
  ["2026-07-01", "2026-07-06", WEEKS[0]],
  ["2026-07-07", "2026-07-13", WEEKS[1]],
  ["2026-07-14", "2026-07-20", WEEKS[2]],
  ["2026-07-21", "2026-07-27", WEEKS[3]],
  ["2026-07-28", "2026-08-04", WEEKS[4]],
  ["2026-08-05", "2026-08-11", WEEKS[5]],
  ["2026-08-12", "2026-08-18", WEEKS[6]],
  ["2026-08-19", "2026-08-24", WEEKS[7]],
  ["2026-08-25", "2026-08-31", WEEKS[8]],
];
