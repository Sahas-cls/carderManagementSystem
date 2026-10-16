import { useEffect, useMemo, useState } from "react";
import Button from "../../../components/ui/Button";
import { getDesignations } from "../../../services/designationServices";
import { getDepartments } from "../../../services/departmentServices";
import { getSections } from "../../../services/sectionServices";

// The three ways someone leaves the Training Center. The category doubles as
// the transfer reason (the server records it as the exit's reason).
export const TC_TRANSFER_TYPES = [
  { value: "prod_mo", label: "To Prod as MO", short: "To Prod - MO" },
  { value: "prod_tmo", label: "To Prod as TMO", short: "To Prod - TMO" },
  { value: "external", label: "External Transfer", short: "External" },
];

export const tcTransferTypeLabel = (value) =>
  TC_TRANSFER_TYPES.find((t) => t.value === value)?.label || "-";

const EMPTY_ROW = {
  tcTransferType: "",
  epf: "",
  employeeName: "",
  designationId: "",
  // Designation they move into in production - not applicable to an
  // external transfer.
  newDesignationId: "",
  departmentId: "",
  sectionId: "",
  dateOfResign: "",
};

/** Whether every required field on one row is filled in. */
function isRowComplete(row) {
  const required = ["tcTransferType", "epf", "employeeName", "designationId", "departmentId", "sectionId", "dateOfResign"];
  if (row.tcTransferType !== "external") required.push("newDesignationId");
  return required.every((field) => !!row[field]);
}

/**
 * Popup for the Training Center's "Transfer to Pro Line" count - collects one
 * employee per transferred person (same details as the production Transfer
 * tile's popup) and which of the three categories they left by:
 *  - To Prod as MO / To Prod as TMO: removed from the Training Center and
 *    added to the production cadre's MO / TMO count.
 *  - External Transfer: removed from the Training Center only.
 * Opens when the count goes above the employees already on file; rows already
 * on file are shown first so they can be reviewed, new ones start blank.
 * Nothing reaches the form until Save Details; the caller (CadreDetailsCard)
 * derives Released from Tr. Cen. MO/TMO from the saved rows.
 */
export default function TcTransferEmployeesModal({
  isOpen,
  onClose,
  initialEmployees,
  total,
  factoryId,
  entryDate,
  onSave,
}) {
  const [rows, setRows] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [error, setError] = useState("");
  const [designations, setDesignations] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [sections, setSections] = useState([]);

  useEffect(() => {
    if (!isOpen) return;
    setError("");
    const saved = (initialEmployees || []).slice(0, total);
    const next = saved.map((e) => ({ ...EMPTY_ROW, ...e, newDesignationId: e.newDesignationId || "" }));
    // Keep the active tab on the first row that still needs details.
    while (next.length < total) next.push({ ...EMPTY_ROW, dateOfResign: entryDate || "" });
    setRows(next);
    const firstBlank = next.findIndex((row) => !isRowComplete(row));
    setActiveIndex(firstBlank === -1 ? 0 : firstBlank);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, total]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    Promise.all([getDesignations(), getDepartments(factoryId), getSections()])
      .then(([d, dept, s]) => {
        if (cancelled) return;
        setDesignations(d || []);
        setDepartments(dept || []);
        setSections(s || []);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Failed to load dropdown options.");
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, factoryId]);

  const updateRow = (index, field, value) => {
    setRows((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;
        const next = { ...row, [field]: value };
        if (field === "tcTransferType" && value === "external") next.newDesignationId = "";
        return next;
      }),
    );
    setError("");
  };

  const epfDuplicates = useMemo(() => {
    const seen = new Map();
    const duplicates = new Set();
    rows.forEach((row, i) => {
      const epf = row.epf.trim();
      if (!epf) return;
      if (seen.has(epf)) {
        duplicates.add(seen.get(epf));
        duplicates.add(i);
      } else {
        seen.set(epf, i);
      }
    });
    return duplicates;
  }, [rows]);

  const completedCount = rows.filter(isRowComplete).length;
  const firstIncompleteIndex = rows.findIndex((row) => !isRowComplete(row));
  const canSave = completedCount === rows.length && epfDuplicates.size === 0;

  const counts = useMemo(
    () => ({
      prod_mo: rows.filter((r) => r.tcTransferType === "prod_mo").length,
      prod_tmo: rows.filter((r) => r.tcTransferType === "prod_tmo").length,
      external: rows.filter((r) => r.tcTransferType === "external").length,
    }),
    [rows],
  );

  const handleConfirm = () => {
    if (firstIncompleteIndex !== -1) {
      setActiveIndex(firstIncompleteIndex);
      setError(`Employee #${firstIncompleteIndex + 1}: please fill in every field before saving.`);
      return;
    }
    if (epfDuplicates.size > 0) {
      setActiveIndex([...epfDuplicates][0]);
      setError("Each employee must have a unique EPF No.");
      return;
    }
    onSave(
      rows.map((row) => ({
        ...row,
        epf: row.epf.trim(),
        employeeName: row.employeeName.trim(),
        isMo: row.tcTransferType === "prod_mo" ? true : row.tcTransferType === "prod_tmo" ? false : null,
      })),
    );
    onClose();
  };

  if (!isOpen) return null;

  const row = rows[activeIndex];
  const selectCls =
    "w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-3xl mx-4 p-6 max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-800">Training Center Transfer Details</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-3 rounded-md mb-4 bg-blue-50 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-gray-600">
            Enter details for all <strong>{total}</strong> transferred employee(s) and choose how each one left:{" "}
            <strong>{counts.prod_mo}</strong> to Prod as MO, <strong>{counts.prod_tmo}</strong> to Prod as TMO,{" "}
            <strong>{counts.external}</strong> external.
          </p>
          <span
            className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${
              completedCount === total ? "bg-green-100 text-green-700" : "bg-orange-soft text-[#89511d]"
            }`}
          >
            {completedCount} / {total} completed
          </span>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {rows.map((r, i) => {
            const complete = isRowComplete(r) && !epfDuplicates.has(i);
            const active = i === activeIndex;
            return (
              <button
                key={i}
                type="button"
                onClick={() => setActiveIndex(i)}
                className={`relative w-11 h-11 rounded-md text-sm font-semibold border transition-colors ${
                  active
                    ? "bg-teal text-white border-teal"
                    : complete
                      ? "bg-green-50 text-green-700 border-green-300 hover:bg-green-100"
                      : "bg-white text-gray-500 border-gray-300 hover:bg-gray-50"
                }`}
                title={`Employee #${i + 1} - ${complete ? "complete" : "incomplete"}`}
              >
                #{i + 1}
                {!complete && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-red-500 border-2 border-white" />
                )}
              </button>
            );
          })}
        </div>

        <div className="overflow-y-auto flex-1 pr-1">
          {row && (
            <div className="border border-gray-200 rounded-md p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="col-span-full flex items-center gap-2 -mt-1 mb-1">
                <span className="text-sm font-semibold text-gray-700">Employee #{activeIndex + 1}</span>
              </div>

              <Field label="Transfer Type" className="col-span-full sm:col-span-2">
                <select
                  className={selectCls}
                  value={row.tcTransferType}
                  onChange={(e) => updateRow(activeIndex, "tcTransferType", e.target.value)}
                >
                  <option value="">Select…</option>
                  {TC_TRANSFER_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-gray-500 mt-1">
                  To Prod moves them into the production cadre&apos;s MO / TMO count; External only removes them from
                  the Training Center.
                </p>
              </Field>

              <Field label="EPF No.">
                <input
                  type="text"
                  className={`${selectCls} ${epfDuplicates.has(activeIndex) ? "border-red-400" : ""}`}
                  value={row.epf}
                  onChange={(e) => updateRow(activeIndex, "epf", e.target.value)}
                />
                {epfDuplicates.has(activeIndex) && (
                  <p className="text-[11px] text-red-600 mt-1">Duplicate EPF No. - each employee must be unique.</p>
                )}
              </Field>

              <Field label="Name">
                <input
                  type="text"
                  className={selectCls}
                  value={row.employeeName}
                  onChange={(e) => updateRow(activeIndex, "employeeName", e.target.value)}
                />
              </Field>

              <Field label="Old Designation">
                <select
                  className={selectCls}
                  value={row.designationId}
                  onChange={(e) => updateRow(activeIndex, "designationId", e.target.value)}
                >
                  <option value="">Select…</option>
                  {designations.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.designation}
                    </option>
                  ))}
                </select>
              </Field>

              {row.tcTransferType !== "external" && (
                <Field label="New Designation">
                  <select
                    className={selectCls}
                    value={row.newDesignationId}
                    onChange={(e) => updateRow(activeIndex, "newDesignationId", e.target.value)}
                  >
                    <option value="">Select…</option>
                    {designations.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.designation}
                      </option>
                    ))}
                  </select>
                </Field>
              )}

              <Field label="Department">
                <select
                  className={selectCls}
                  value={row.departmentId}
                  onChange={(e) => updateRow(activeIndex, "departmentId", e.target.value)}
                >
                  <option value="">Select…</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.departmentName}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Section">
                <select
                  className={selectCls}
                  value={row.sectionId}
                  onChange={(e) => updateRow(activeIndex, "sectionId", e.target.value)}
                >
                  <option value="">Select…</option>
                  {sections.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.sectionName}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Effective Date">
                <input
                  type="date"
                  className={selectCls}
                  value={row.dateOfResign}
                  onChange={(e) => updateRow(activeIndex, "dateOfResign", e.target.value)}
                />
              </Field>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-md text-sm mt-4">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleConfirm}
            disabled={!canSave}
            title={canSave ? undefined : "Fill in every employee's details (see the marked tabs) before saving."}
          >
            Save Details
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children, className = "" }) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  );
}
