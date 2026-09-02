// Colorblind-safe categorical palette (validated with the data-viz skill's
// contrast/CVD-separation checks). Distinct from the app's navy/teal/orange
// brand chrome, which reads too low-contrast/low-chroma for small data marks.
export const CHART_COLORS = {
  blue: "#2a78d6",
  orange: "#eb6834",
  aqua: "#1baf7a",
  violet: "#4a3aa7",
  red: "#d03b3b",
};

export const CHART_INK = {
  primary: "#243342",
  muted: "#657382",
  grid: "#e4e9ee",
  axis: "#c7d0d9",
};

/** Short dd/mm label for chart x-axes. */
export function formatShortDate(dateStr) {
  if (!dateStr) return "-";
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}
