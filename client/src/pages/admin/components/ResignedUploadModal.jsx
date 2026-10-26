import { useState } from "react";
import Swal from "sweetalert2";
import Button from "../../../components/ui/Button";
import { FieldInput, FieldSelect } from "../../../components/ui/FormField";
import { readResignedWorkbook } from "../../../utils/excelImport";
import { importResignedEmployees } from "../../../services/employeeServices";

const STAT_LABELS = [
  ["exits", "Exits to import"],
  ["newEmployees", "New employees"],
  ["existingEmployees", "Already in system"],
  ["linked", "Linked to Daily Entry"],
  ["unlinked", "Not linked (no entry)"],
  ["mo", "Linked as MO"],
  ["tmo", "Linked as TMO"],
  ["rejoined", "Recorded as rejoined"],
  ["placeholderJoins", "Join date placeholder (1177-07-07)"],
];

function RowList({ title, rows, tone }) {
  if (!rows?.length) return null;
  return (
    <details className="mt-3" open={tone === "red"}>
      <summary
        className={`cursor-pointer text-sm font-semibold ${tone === "red" ? "text-red-700" : "text-gray-700"}`}
      >
        {title} ({rows.length})
      </summary>
      <div className="max-h-56 overflow-auto mt-2 border border-gray-200 rounded">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 sticky top-0">
            <tr className="text-left text-gray-500">
              <th className="py-1 px-2">Sheet / Row</th>
              <th className="py-1 px-2">EPF</th>
              <th className="py-1 px-2">Name</th>
              <th className="py-1 px-2">Resigned</th>
              <th className="py-1 px-2">Details</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-gray-100">
                <td className="py-1 px-2 whitespace-nowrap">
                  {r.sheet} / {r.line}
                </td>
                <td className="py-1 px-2">{r.epf}</td>
                <td className="py-1 px-2">{r.employeeName}</td>
                <td className="py-1 px-2 whitespace-nowrap">{r.dateOfResign || "-"}</td>
                <td className="py-1 px-2">
                  {r.why ??
                    [
                      r.type === "tc_resign" ? "Training Center" : "Line",
                      r.linked ? `linked (${r.isMo ? "MO" : "TMO"})` : "not linked",
                      r.rejoined && "rejoined",
                      r.placeholderJoin && "join date placeholder",
                    ]
                      .filter(Boolean)
                      .join(", ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

/**
 * Upload Resigned (Manage Employees, Administrator only): reads a factory's
 * resigned-employee workbook in the browser, previews what the server would
 * import (nothing saved), then imports it on confirmation. See
 * server/src/services/employeeImportService.js for the rules.
 */
export default function ResignedUploadModal({ factories, onClose, onImported }) {
  const [file, setFile] = useState(null);
  const [rows, setRows] = useState(null);
  const [options, setOptions] = useState({ factoryId: "", from: "", to: "", dayFirst: false });
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const change = (patch) => {
    setOptions((prev) => ({ ...prev, ...patch }));
    setReport(null);
    setError("");
  };

  const handleFile = async (e) => {
    const picked = e.target.files?.[0] || null;
    setFile(picked);
    setRows(null);
    setReport(null);
    setError("");
    if (!picked) return;
    try {
      const parsed = await readResignedWorkbook(picked);
      if (!parsed.length) throw new Error("No employee rows were found in this file.");
      setRows(parsed);
      // Pre-select the factory whose code (e.g. "CAL") appears in the file name.
      const name = picked.name.toLowerCase();
      const match = factories.find((f) => {
        const code = f.factoryCode?.toLowerCase();
        return code && /^[a-z0-9]+$/.test(code) && new RegExp(`(^|[^a-z])${code}([^a-z]|$)`).test(name);
      });
      if (match) setOptions((prev) => ({ ...prev, factoryId: String(match.id) }));
    } catch (err) {
      setError(err.message || "Could not read this file.");
    }
  };

  const run = async (apply) => {
    if (!rows) return setError("Choose an Excel file first.");
    if (!options.factoryId) return setError("Select the factory this file belongs to.");
    if (!options.from || !options.to) return setError("Enter the resign date range.");
    if (options.from > options.to) return setError("The From date cannot be after the To date.");
    if (apply) {
      const factoryName = factories.find((f) => String(f.id) === options.factoryId)?.factoryName;
      const { isConfirmed } = await Swal.fire({
        title: "Import resigned employees?",
        text: `${report.stats.exits} exit(s) will be saved for ${factoryName}. This can't be undone from the app.`,
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Yes, import",
      });
      if (!isConfirmed) return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await importResignedEmployees({
        factoryId: Number(options.factoryId),
        from: options.from,
        to: options.to,
        dayFirst: options.dayFirst,
        apply,
        fileName: file?.name,
        rows,
      });
      setReport(result);
      if (apply) {
        Swal.fire({
          title: "Imported!",
          text: `${result.stats.exits} exit(s) saved (${result.stats.newEmployees} new employee(s)).`,
          icon: "success",
        });
        onImported?.();
      }
    } catch (err) {
      setError(err.message || "Upload failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={busy ? undefined : onClose} />

      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-3xl mx-4 p-6 max-h-[90vh] overflow-auto">
        <h2 className="text-lg font-semibold text-gray-800">Upload Resigned Employees</h2>
        <p className="text-xs text-gray-500 mt-1 mb-4">
          One factory's workbook (Line sheet + "TR" Training Center sheet, header row with EPF, Name,
          Designation, Department, Section, Date of Join, Date of Resign, Date of Birth, Civil Status,
          Reason). Each exit is linked to that factory's Daily Data Entry of its resign date; an
          employee resigned more than once gets every earlier exit recorded as rejoined. Rows already
          on file are skipped, so uploading the same file twice is safe.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <FieldInput label="Excel file (.xlsx)" type="file" accept=".xlsx" onChange={handleFile} className="pt-1.5" />
          <FieldSelect
            label="Factory"
            value={options.factoryId}
            onChange={(e) => change({ factoryId: e.target.value })}
          >
            <option value="">Select Factory</option>
            {factories.map((f) => (
              <option key={f.id} value={f.id}>
                {f.factoryName}
              </option>
            ))}
          </FieldSelect>
          <FieldInput
            label="Resign date from"
            type="date"
            value={options.from}
            max={options.to || undefined}
            onChange={(e) => change({ from: e.target.value })}
          />
          <FieldInput
            label="Resign date to"
            type="date"
            value={options.to}
            min={options.from || undefined}
            onChange={(e) => change({ to: e.target.value })}
          />
        </div>
        <label className="flex items-center gap-2 mt-3 text-xs text-gray-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={options.dayFirst}
            onChange={(e) => change({ dayFirst: e.target.checked })}
          />
          Dates typed as text are day-first (DD/MM/YYYY)
        </label>
        {rows && (
          <p className="text-xs text-gray-500 mt-2">
            {rows.length} row(s) read from {new Set(rows.map((r) => r.sheet)).size} sheet(s).
          </p>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-md text-sm mt-4">{error}</div>
        )}

        {report && (
          <div className="mt-4 border-t border-gray-200 pt-4">
            <h3 className="text-sm font-semibold text-gray-800">
              {report.applied ? "Imported" : "Preview"} - {report.factoryName}, {report.from} to {report.to}
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              {report.totalRows} row(s) in file, {report.outOfRange} outside the date range left out.
              {!report.applied && " Nothing has been saved yet."}
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-3">
              {STAT_LABELS.map(([k, label]) => (
                <div key={k} className="bg-gray-50 border border-gray-200 rounded px-3 py-2">
                  <div className="text-[11px] text-gray-500">{label}</div>
                  <div className="text-base font-semibold text-gray-800">{report.stats[k]}</div>
                </div>
              ))}
            </div>
            <RowList title="Skipped - fix in the file and upload again" rows={report.skipped} tone="red" />
            <RowList title="Duplicate rows in the file (ignored)" rows={report.duplicates} />
            <RowList title="Already on file (ignored)" rows={report.alreadyOnFile} />
            <RowList title={report.applied ? "Imported exits" : "Exits to import"} rows={report.imported} />
          </div>
        )}

        <div className="flex justify-end gap-3 mt-6">
          <Button onClick={onClose} disabled={busy}>
            {report?.applied ? "Close" : "Cancel"}
          </Button>
          {!report?.applied && (
            <Button variant="teal" onClick={() => run(false)} disabled={busy || !rows}>
              {busy && !report ? "Checking..." : "Preview"}
            </Button>
          )}
          {report && !report.applied && (
            <Button variant="orange" onClick={() => run(true)} disabled={busy || !report.stats.exits}>
              {busy ? "Importing..." : "Import"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
