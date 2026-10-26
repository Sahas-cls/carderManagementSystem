import ExcelJS from "exceljs";

// Header text (lower-cased, spaces collapsed) -> field posted to
// /employees/import-resigned. The header row is found by its "EPF" cell, so
// title rows above it and the column order don't matter.
const HEADERS = {
  epf: "epf",
  "epf no": "epf",
  "epf number": "epf",
  name: "employeeName",
  "employee name": "employeeName",
  designation: "designation",
  department: "department",
  section: "section",
  "date of join": "dateOfJoin",
  "date of joining": "dateOfJoin",
  "date of resign": "dateOfResign",
  "date of resignation": "dateOfResign",
  "date of birth": "dateOfBirth",
  "civil status": "civilStatus",
  reason: "reason",
  "resignation reason": "reason",
};
const DATE_FIELDS = new Set(["dateOfJoin", "dateOfResign", "dateOfBirth"]);
const REQUIRED = ["epf", "employeeName", "dateOfResign"];

const norm = (s) => String(s ?? "").replace(/\s+/g, " ").trim().toLowerCase();

// Unwraps ExcelJS's rich text / formula / hyperlink cell objects.
function plain(value) {
  if (value == null) return null;
  if (value instanceof Date) return value;
  if (typeof value === "object") {
    if (value.richText) return value.richText.map((t) => t.text).join("");
    if ("result" in value) return plain(value.result);
    if ("text" in value) return plain(value.text);
    return null;
  }
  return value;
}

// Date cells come back as UTC midnight Dates; an unformatted one as an Excel
// serial number. Text dates are passed through for the server to parse.
function toDate(value) {
  if (value instanceof Date) return isNaN(value) ? null : value.toISOString().slice(0, 10);
  if (typeof value === "number" && value > 20000 && value < 80000) {
    return new Date(Date.UTC(1899, 11, 30) + value * 86400000).toISOString().slice(0, 10);
  }
  return value == null ? null : String(value).trim();
}

/**
 * Reads a resigned-employee workbook (one sheet per Line / Training Center)
 * into [{ sheet, line, epf, employeeName, designation, ..., reason }].
 * Throws if a sheet with data has no recognisable header row.
 */
export async function readResignedWorkbook(file) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const rows = [];
  wb.eachSheet((ws) => {
    let columns = null;
    ws.eachRow((row, line) => {
      const cells = row.values; // 1-based
      if (!columns) {
        const found = {};
        cells.forEach((v, col) => {
          const field = HEADERS[norm(plain(v))];
          if (field && !(field in found)) found[field] = col;
        });
        if ("epf" in found) {
          const missing = REQUIRED.filter((f) => !(f in found));
          if (missing.length) {
            throw new Error(`Sheet "${ws.name}" is missing the column(s): ${missing.join(", ")}.`);
          }
          columns = found;
        }
        return;
      }
      const record = { sheet: ws.name, line };
      for (const [field, col] of Object.entries(columns)) {
        const v = plain(cells[col]);
        record[field] = DATE_FIELDS.has(field) ? toDate(v) : v == null ? null : String(v).trim();
      }
      if (record.epf) rows.push(record);
    });
  });
  return rows;
}
