// Colorblind-safe categorical palette (validated with the data-viz skill's
// contrast/CVD-separation checks). Distinct from the app's navy/teal/orange
// brand chrome, which reads too low-contrast/low-chroma for small data marks.
export const CHART_COLORS = {
  blue: "#2a78d6",
  orange: "#eb6834",
  aqua: "#1baf7a",
  yellow: "#eda100",
  magenta: "#e87ba4",
  green: "#008300",
  violet: "#4a3aa7",
  red: "#d03b3b",
};

// Same order as CHART_COLORS above - this is the CVD-safety mechanism (see
// the data-viz skill's color-formula.md), not cosmetic. Use this instead of
// Object.values(CHART_COLORS) when a chart needs N colors for N categories
// whose count isn't fixed up front (e.g. an admin-configurable number of
// buckets) - slice it to length, never reorder or cycle it.
export const CATEGORICAL_COLORS = [
  CHART_COLORS.blue,
  CHART_COLORS.orange,
  CHART_COLORS.aqua,
  CHART_COLORS.yellow,
  CHART_COLORS.magenta,
  CHART_COLORS.green,
  CHART_COLORS.violet,
  CHART_COLORS.red,
];

export const CHART_INK = {
  primary: "#243342",
  muted: "#657382",
  grid: "#e4e9ee",
  axis: "#c7d0d9",
};

// For an aggregate "Other" slice (the long tail folded together, e.g. every
// resignation reason past the top few) - deliberately NOT one of
// CATEGORICAL_COLORS, since "Other" isn't a stable category identity (its
// composition changes with the data) and shouldn't visually compete with the
// real ones.
export const OTHER_COLOR = "#9aa5b1";

/** Short dd/mm label for chart x-axes. */
export function formatShortDate(dateStr) {
  if (!dateStr) return "-";
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Short month label ("Jan", "Feb", ...) from a "YYYY-MM" string, for year-long trend charts. */
export function formatMonthLabel(monthStr) {
  if (!monthStr) return "-";
  const idx = Number(monthStr.slice(5, 7)) - 1;
  return MONTH_LABELS[idx] ?? monthStr;
}
