import * as XLSX from "xlsx";

const DAILY_HEADERS = [
  "Factory",
  "Date",
  "Week No.",
  "Planned MO",
  "Planned TMO",
  "Planned Total",
  "Allocated_Actual MO",
  "Allocated_Actual TMO",
  "Allocated_Actual Total",
  "Shortage MO",
  "Shortage TMO",
  "Shortage Total",
  "New Recr. MO",
  "New Recr. TMO",
  "New Recr. Total",
  "Resigned/Terminated MO",
  "Resigned/Terminated TMO",
  "Resigned/Terminated Total",
  "Net Increase/Decrease MO",
  "Net Increase/Decrease TMO",
  "Net Increase/Decrease Total",
  "Allocated_Current MO",
  "Allocated_Current TMO",
  "Allocated_Current Total",
  "Absenteeism MO",
  "Absenteeism TMO",
  "Absenteeism Total",
  "Present MO",
  "Present TMO",
  "Present Total",
  "TMO_Training Center Planned",
  "TMO_Training Center Allocated",
  "TMO_Training Center Recruit.",
  "TMO_Training Center Resigned",
  "TMO_Training Center Transfer to Pro Line",
  "TMO_Training Center Actual Allocated",
  "TMO_Training Center Absent.",
  "TMO_Training Center Present",
];

const WEEKLY_HEADERS = [
  "Company Name",
  "Week No/ Date",
  "Allocated_ MO",
  "Allocated_ TMO",
  "Allocated_ Total",
  "Absent. MO",
  "Absent. TMO",
  "Absent. Total",
  "Present MO",
  "Present TMO",
  "Present Total",
  "TMO_ Training Center Allocated",
  "TMO_ Training Center Absent.",
  "TMO_ Training Center Present",
];

function columnWidths(headers) {
  return headers.map((h) => ({ wch: Math.max(14, Math.min(30, h.length + 2)) }));
}

function writeSheet(headers, rows, sheetName, fileName) {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws["!freeze"] = { xSplit: 0, ySplit: 1 };
  ws["!autofilter"] = { ref: ws["!ref"] };
  ws["!cols"] = columnWidths(headers);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, fileName);
}

export function exportDailyExcel(records) {
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
  writeSheet(DAILY_HEADERS, rows, "Daily Data", "Daily_Cadre_Status_Report.xlsx");
}

export function exportWeeklyExcel(records) {
  const rows = records.map((r) => [
    r.factory || "-",
    `${r.week || "-"}${r.date ? " / " + r.date : ""}`,
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
  writeSheet(WEEKLY_HEADERS, rows, "Weekly Data", "Weekly_Cadre_Status_Report.xlsx");
}
