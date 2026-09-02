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
  { header: "New Recr. MO_Rejoined MO_TMO\nreleased from Tr. Cen.", subs: MO_TMO_TOTAL },
  { header: "Resigned/Terminated", subs: MO_TMO_TOTAL },
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
    r.rmo,
    r.rtmo,
    r.rt,
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
