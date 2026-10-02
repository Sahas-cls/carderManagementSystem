import ExcelJS from "exceljs";

// Same palette as the on-screen tables (see DailyRecordsTable.jsx /
// WeeklyGroupTable.jsx / client/src/index.css) so the exported workbook
// looks like a screenshot of the table rather than a generic data dump.
const NAVY = "FF214F7D"; // --color-navy, row 1 of the header band
const HEADER_BLUE = "FF376C9E"; // row 2 of the header band
const BORDER_COLOR = "FF94A3B8"; // tailwind slate-400, used for every cell border
const WHITE = "FFFFFFFF";

const THIN_BORDER = { style: "thin", color: { argb: BORDER_COLOR } };
const ALL_BORDERS = { top: THIN_BORDER, left: THIN_BORDER, bottom: THIN_BORDER, right: THIN_BORDER };

function styleHeaderCell(cell, bg, { size = 10 } = {}) {
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
  cell.font = { color: { argb: WHITE }, bold: true, size };
  cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  cell.border = ALL_BORDERS;
}

function styleDataCell(cell, { bold = false } = {}) {
  cell.font = { bold, size: 10.5 };
  cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  cell.border = ALL_BORDERS;
}

/**
 * Lays out the two-row grouped header (leading rowspan-2 columns, then
 * colspan-N group columns each with their own MO/TMO/Total-style sub
 * columns) that both Daily Data Records and Weekly Data View use on
 * screen, and returns the column metadata (widths + which columns are the
 * bold "Total" column of their group) needed to fill in the data rows.
 */
function buildGroupedHeader(ws, { leadingCols, groups }) {
  const row1 = ws.getRow(1);
  const row2 = ws.getRow(2);
  const boldCols = new Set();
  let col = 1;

  for (const { header, width } of leadingCols) {
    ws.getColumn(col).width = width;
    ws.mergeCells(1, col, 2, col);
    const cell = row1.getCell(col);
    cell.value = header;
    styleHeaderCell(cell, NAVY, { size: 11 });
    styleHeaderCell(row2.getCell(col), NAVY, { size: 11 }); // style the merged-over cell too so its border shows
    col += 1;
  }

  for (const { header, subs } of groups) {
    const startCol = col;
    for (const { label, width, bold } of subs) {
      ws.getColumn(col).width = width;
      const cell = row2.getCell(col);
      cell.value = label;
      styleHeaderCell(cell, HEADER_BLUE);
      if (bold) boldCols.add(col);
      col += 1;
    }
    const endCol = col - 1;
    if (endCol > startCol) ws.mergeCells(1, startCol, 1, endCol);
    const groupCell = row1.getCell(startCol);
    groupCell.value = header;
    styleHeaderCell(groupCell, NAVY, { size: 11 });
    for (let c = startCol; c <= endCol; c += 1) styleHeaderCell(row1.getCell(c), NAVY, { size: 11 });
  }

  row1.height = 42;
  row2.height = 28;
  ws.views = [{ state: "frozen", ySplit: 2, showGridLines: false }];

  return { columnCount: col - 1, boldCols };
}

function fillDataRows(ws, rows, boldCols) {
  rows.forEach((rowValues, i) => {
    const row = ws.getRow(3 + i);
    rowValues.forEach((value, j) => {
      const cell = row.getCell(j + 1);
      cell.value = value === undefined || value === null || value === "" ? "-" : value;
      styleDataCell(cell, { bold: boldCols.has(j + 1) });
    });
  });
}

async function downloadWorkbook(workbook, fileName) {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Sub-column spec shared by every MO/TMO/Total group in both sheets - only
// the "Total" column is bold, matching the `font-bold` class on those <td>s.
const MO_TMO_TOTAL = [
  { label: "MO", width: 8 },
  { label: "TMO", width: 8 },
  { label: "Total", width: 9, bold: true },
];

/** Mirrors DailyRecordsTable.jsx's header exactly (see client/src/pages/cadre/components/DailyRecordsTable.jsx). */
const DAILY_LEADING_COLS = [
  { header: "Factory", width: 22 },
  { header: "Date", width: 12 },
  { header: "Week No.", width: 12 },
];

const DAILY_GROUPS = [
  { header: "Planned MO/TMO", subs: MO_TMO_TOTAL },
  { header: "Allocated_Actual MO/TMO", subs: MO_TMO_TOTAL },
  { header: "Shortage MO/TMO", subs: MO_TMO_TOTAL },
  { header: "New Recruitments MO/TMO", subs: MO_TMO_TOTAL },
  { header: "Rejoined MO/TMO", subs: MO_TMO_TOTAL },
  { header: "Released from Tr. Cen. MO/TMO", subs: MO_TMO_TOTAL },
  { header: "Resigned/Terminated", subs: MO_TMO_TOTAL },
  { header: "Transfer", subs: MO_TMO_TOTAL },
  { header: "Net Increase/Decrease", subs: MO_TMO_TOTAL },
  { header: "Allocated_Current MO/TMO", subs: MO_TMO_TOTAL },
  { header: "Absenteeism", subs: MO_TMO_TOTAL },
  { header: "Present MO/TMO", subs: MO_TMO_TOTAL },
  {
    header: "TMO_Training Center.",
    subs: [
      { label: "Planned", width: 9 },
      { label: "Allocated", width: 10 },
      { label: "Recruit.", width: 9 },
      { label: "Resigned", width: 9 },
      { label: "Transfer to Pro Line", width: 15 },
      { label: "Actual Allocated", width: 13 },
      { label: "Absent.", width: 9 },
      { label: "Present", width: 9, bold: true },
    ],
  },
];

export async function exportDailyExcel(records) {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet("Daily Data");
  const { boldCols } = buildGroupedHeader(ws, { leadingCols: DAILY_LEADING_COLS, groups: DAILY_GROUPS });

  const rows = records.map((r) => [
    r.factory,
    r.date || "-",
    r.week || "-",
    r.pmo,
    r.ptmo,
    r.pt,
    r.amo,
    r.atmo,
    r.at,
    r.smo,
    r.stmo,
    r.st,
    r.nmo,
    r.ntmo,
    r.nt,
    r.rjmo,
    r.rjtmo,
    r.rjt,
    r.relmo,
    r.reltmo,
    r.relt,
    r.rmo,
    r.rtmo,
    r.rt,
    r.tfmo,
    r.tftmo,
    r.tft,
    r.netmo,
    r.netto,
    r.nett,
    r.cmo,
    r.ctmo,
    r.ct,
    r.abmo,
    r.abtmo,
    r.abt,
    r.prmo,
    r.prtmo,
    r.prt,
    r.tcp,
    r.tca,
    r.tcr,
    r.tcs,
    r.tct,
    r.tactual,
    r.tcab,
    r.tcpresent,
  ]);
  fillDataRows(ws, rows, boldCols);

  await downloadWorkbook(workbook, "Daily_Cadre_Status_Report.xlsx");
}

/** Mirrors WeeklyGroupTable.jsx's header exactly (see client/src/pages/cadre/components/WeeklyGroupTable.jsx). */
const WEEKLY_LEADING_COLS = [
  { header: "Company Name", width: 24 },
  { header: "Week No/ Date", width: 16 },
];

const WEEKLY_GROUPS = [
  { header: "Allocated_ MO/TMO", subs: MO_TMO_TOTAL },
  { header: "Absent. MO/ TMO", subs: MO_TMO_TOTAL },
  { header: "Present MO/TMO", subs: MO_TMO_TOTAL },
  {
    header: "TMO_ Training Center",
    subs: [
      { label: "Allocated", width: 11 },
      { label: "Absent.", width: 9 },
      { label: "Present", width: 9, bold: true },
    ],
  },
];

export async function exportWeeklyExcel(records) {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet("Weekly Data");
  const { boldCols } = buildGroupedHeader(ws, { leadingCols: WEEKLY_LEADING_COLS, groups: WEEKLY_GROUPS });

  const rows = records.map((r) => [
    r.factory || "-",
    `${r.week || "-"}${r.date ? "\n" + r.date : ""}`,
    r.amo,
    r.atmo,
    r.at,
    r.abmo,
    r.abtmo,
    r.abt,
    r.prmo,
    r.prtmo,
    r.prt,
    r.tca,
    r.tcab,
    r.tcpresent,
  ]);
  fillDataRows(ws, rows, boldCols);

  await downloadWorkbook(workbook, "Weekly_Cadre_Status_Report.xlsx");
}

// ---------------------------------------------------------------------------
// "Weekly Cadre Status Report" (Weekly Data View's Download Excel 2) - laid
// out like the HR team's own "Weekly Cadre Status Report_ <Month>.xlsx":
// one block of weekly rows per factory, thin spacer columns between the
// MO/TMO groups, and Total/Present cells as live Excel formulas.
// ---------------------------------------------------------------------------

const REPORT_TITLE = "Concord_ Sri Lanka";
const REPORT_HEADER_FILL = "FF3B618E"; // the template's accent1, 25% darker
const REPORT_TOTAL_FILL = "FFD2DBE5"; // the template's light-blue Total columns
const REPORT_FONT = { name: "Calibri", size: 10 };
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** 1 -> "1st", 2 -> "2nd", 11 -> "11th", 22 -> "22nd". */
function ordinal(n) {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  return `${n}${{ 1: "st", 2: "nd", 3: "rd" }[n % 10] || "th"}`;
}

/** "July_August_September 2026", or "December 2025_January 2026" across a year boundary. */
function monthSpanLabel(from, to) {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  const parts = [];
  for (let y = fy, m = fm; y < ty || (y === ty && m <= tm); m === 12 ? (y += 1, m = 1) : (m += 1)) {
    parts.push({ y, name: MONTH_NAMES[m - 1] });
  }
  if (fy === ty) return `${parts.map((p) => p.name).join("_")} ${fy}`;
  return parts.map((p) => `${p.name} ${p.y}`).join("_");
}

// Column layout, mirroring the template (plus a Budget group ahead of
// Allocated): A Se No, B Company, C Week/Date, then MO/TMO/Total groups at
// E-G (Budget), I-K (Allocated), M-O (Absent), Q-S (Present) and the
// Training Center at U-W, with narrow blank spacer columns (D, H, L, P, T)
// between them.
const REPORT_WIDTHS = {
  A: 5, B: 34, C: 30, D: 1,
  E: 8, F: 8, G: 8, H: 1,
  I: 8, J: 8, K: 8, L: 1,
  M: 8, N: 8, O: 8, P: 1,
  Q: 8, R: 8, S: 8, T: 1,
  U: 10, V: 8, W: 9,
};
const REPORT_GROUPS = [
  { start: "E", end: "G", header: "Budget_MO/TMO", subs: ["MO", "TMO", "Total"] },
  { start: "I", end: "K", header: "Allocated_MO/TMO", subs: ["MO", "TMO", "Total"] },
  { start: "M", end: "O", header: "Absent. MO/ TMO", subs: ["MO", "TMO", "Total"] },
  { start: "Q", end: "S", header: "Present MO/TMO", subs: ["MO", "TMO", "Total"] },
  { start: "U", end: "W", header: "TMO_ Training Center", subs: ["Allocated", "Absent.", "Present"] },
];
const TOTAL_COLS = new Set(["G", "K", "O", "S", "W"]);
const REPORT_DATA_COLS = [
  "A", "B", "C",
  "E", "F", "G",
  "I", "J", "K",
  "M", "N", "O",
  "Q", "R", "S",
  "U", "V", "W",
];

function styleReportHeader(cell, { bold = false } = {}) {
  cell.font = { ...REPORT_FONT, bold, color: { argb: WHITE } };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: REPORT_HEADER_FILL } };
  cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  cell.border = ALL_BORDERS;
}

/**
 * Builds and downloads the Weekly Cadre Status Report for `rows` (from
 * getWeeklyStatusReport - already sorted by factory, then date) covering
 * [from, to]. Each factory's weeks are numbered within their own month
 * ("1st Week_ 1st July 2026", "2nd Week_ 7th July 2026", ...).
 */
export async function exportWeeklyStatusReport(rows, { from, to }) {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet("Cadre_Status", {
    views: [{ state: "frozen", ySplit: 4, showGridLines: false }],
  });
  Object.entries(REPORT_WIDTHS).forEach(([col, width]) => {
    ws.getColumn(col).width = width;
  });

  ws.getCell("A1").value = REPORT_TITLE;
  ws.getCell("A1").font = { name: "Calibri", size: 12, bold: true };
  ws.getCell("A2").value = `MO/ TMO Cadre Status_ ${monthSpanLabel(from, to)}`;
  ws.getCell("A2").font = { name: "Calibri", size: 11 };

  // Two-row header (rows 3-4).
  [["A", "Se No"], ["B", "Company Name"], ["C", "Week No/ Date"]].forEach(([col, label]) => {
    ws.mergeCells(`${col}3:${col}4`);
    ws.getCell(`${col}3`).value = label;
    styleReportHeader(ws.getCell(`${col}3`));
    styleReportHeader(ws.getCell(`${col}4`));
  });
  REPORT_GROUPS.forEach(({ start, end, header, subs }) => {
    ws.mergeCells(`${start}3:${end}3`);
    ws.getCell(`${start}3`).value = header;
    const startCode = start.charCodeAt(0);
    subs.forEach((label, i) => {
      const col = String.fromCharCode(startCode + i);
      styleReportHeader(ws.getCell(`${col}3`));
      ws.getCell(`${col}4`).value = label;
      styleReportHeader(ws.getCell(`${col}4`), { bold: TOTAL_COLS.has(col) });
    });
  });
  ws.getRow(3).height = 26;
  ws.getRow(4).height = 17;

  // Group by factory, keeping the incoming (factory, date) order.
  const blocks = new Map();
  rows.forEach((r) => {
    if (!blocks.has(r.factoryId)) blocks.set(r.factoryId, { factory: r.factory, rows: [] });
    blocks.get(r.factoryId).rows.push(r);
  });

  let rowNum = 5;
  let serial = 0;
  for (const { factory, rows: weekRows } of blocks.values()) {
    serial += 1;
    const blockStart = rowNum;
    const weekOfMonth = new Map(); // "YYYY-MM" -> running count within this factory
    weekRows.forEach((r) => {
      const [y, m, d] = r.date.split("-").map(Number);
      const monthKey = r.date.slice(0, 7);
      const nth = (weekOfMonth.get(monthKey) || 0) + 1;
      weekOfMonth.set(monthKey, nth);

      const n = rowNum;
      const values = {
        C: `${ordinal(nth)} Week_ ${ordinal(d)} ${MONTH_NAMES[m - 1]} ${y}`,
        E: r.budgetMO,
        F: r.budgetTMO,
        G: { formula: `E${n}+F${n}` },
        I: r.allocatedMO,
        J: r.allocatedTMO,
        K: { formula: `I${n}+J${n}` },
        M: r.absentMO,
        N: r.absentTMO,
        O: { formula: `SUM(M${n}:N${n})` },
        Q: { formula: `I${n}-M${n}` },
        R: { formula: `J${n}-N${n}` },
        S: { formula: `K${n}-O${n}` },
        U: r.tcAllocated,
        V: r.tcAbsent,
        W: { formula: `U${n}-V${n}` },
      };
      REPORT_DATA_COLS.forEach((col) => {
        const cell = ws.getCell(`${col}${n}`);
        if (values[col] !== undefined) cell.value = values[col];
        cell.font = { ...REPORT_FONT, bold: TOTAL_COLS.has(col) };
        cell.border = ALL_BORDERS;
        if (TOTAL_COLS.has(col)) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: REPORT_TOTAL_FILL } };
        }
        if (col >= "E") cell.numFmt = "#,##0";
      });
      ws.getRow(n).height = 13;
      rowNum += 1;
    });

    // Se No / Company Name span the factory's whole block.
    if (rowNum - 1 > blockStart) {
      ws.mergeCells(`A${blockStart}:A${rowNum - 1}`);
      ws.mergeCells(`B${blockStart}:B${rowNum - 1}`);
    }
    ws.getCell(`A${blockStart}`).value = serial;
    ws.getCell(`A${blockStart}`).alignment = { horizontal: "center", vertical: "top" };
    ws.getCell(`B${blockStart}`).value = factory;
    ws.getCell(`B${blockStart}`).alignment = { vertical: "top", wrapText: true };

    rowNum += 1; // blank spacer row between factories
  }

  await downloadWorkbook(workbook, `Weekly Cadre Status Report_ ${monthSpanLabel(from, to)}.xlsx`);
}
