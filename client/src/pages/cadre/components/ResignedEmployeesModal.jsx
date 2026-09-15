import { useEffect, useMemo, useState } from "react";
import Button from "../../../components/ui/Button";
import { getDesignations } from "../../../services/designationServices";
import { getDepartments } from "../../../services/departmentServices";
import { getSections } from "../../../services/sectionServices";
import { getResignationReasons } from "../../../services/resignationReasonServices";

const EMPTY_ROW = {
  epf: "",
  employeeName: "",
  designationId: "",
  departmentId: "",
  sectionId: "",
  dateOfJoin: "",
  dateOfResign: "",
  resignationReasonId: "",
  // Only shown/meaningful for a Transfer-tile TMO row - see the "Outcome"
  // dropdown below. Defaults to "leaves this carder".
  promotedToMo: false,
};

const REQUIRED_FIELDS = [
  "epf",
  "employeeName",
  "designationId",
  "departmentId",
  "sectionId",
  "dateOfJoin",
  "dateOfResign",
  "resignationReasonId",
];

/** "2y 3m" from two yyyy-mm-dd strings, or "" while either is missing/invalid. */
function computeServicePeriod(dateOfJoin, dateOfResign) {
  if (!dateOfJoin || !dateOfResign) return "";
  const start = new Date(`${dateOfJoin}T00:00:00`);
  const end = new Date(`${dateOfResign}T00:00:00`);
  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    end < start
  )
    return "";

  let years = end.getFullYear() - start.getFullYear();
  let months = end.getMonth() - start.getMonth();
  if (end.getDate() < start.getDate()) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  return `${years}y ${months}m`;
}

/** Whether every required field on one row is filled in and its dates make sense. */
function isRowComplete(row) {
  if (REQUIRED_FIELDS.some((field) => !row[field])) return false;
  return row.dateOfResign >= row.dateOfJoin;
}

/**
 * Popup for entering details of NEWLY resigned or transferred employees -
 * opened from CadreDetailsCard only when the relevant MO/TMO count goes UP
 * (see handleResignedBlur/handleTransferBlur), asking for details of just
 * the new employee(s) needed to reach the new, higher total. It never needs
 * to reconcile a count going down or offer to remove anyone - that's handled
 * separately by the eye icon next to the tile, which opens
 * ResignedEmployeesListModal to view and permanently delete/rejoin existing
 * employees instead. The first `rmo` rows are Machine Operators, the rest
 * Trainee Machine Operators - this split is purely positional (matches the
 * server's validateExitEmployees), not editable per-row. Shown one employee
 * at a time via the numbered tabs (#1, #2, ...) rather than a long scrolling
 * list; Save Details is disabled until every tab is complete (canSave) - a
 * red dot on a tab marks it as still needing attention. Nothing here is
 * saved to the daily entry's form state until Save Details is clicked -
 * Cancel just closes the popup.
 *
 * `isTransfer` (default false) picks Transfer tile vs Resigned/Terminated
 * tile copy, and - only for Transfer's TMO rows - shows an extra "Outcome"
 * dropdown (promotedToMo: internal promotion that stays in this carder,
 * reclassified MO, vs a transfer that leaves it entirely - see
 * dailyCadreService.computeDerived for the resulting MO/TMO math). The rest
 * of the row shape and validation are identical either way; the caller
 * (CadreDetailsCard) decides which form field the saved rows land in.
 */
export default function ResignedEmployeesModal({
  isOpen,
  onClose,
  initialEmployees,
  rmo,
  rtmo,
  factoryId,
  entryDate,
  onSave,
  isTransfer = false,
}) {
  const employeeLabel = isTransfer ? "transfer" : "resigned";
  const modalTitle = isTransfer
    ? "Transfer Employee Details"
    : "Resigned / Terminated Employee Details";
  const total = rmo + rtmo;
  const [rows, setRows] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [error, setError] = useState("");
  const [designations, setDesignations] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [sections, setSections] = useState([]);
  const [reasons, setReasons] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setError("");
    setActiveIndex(0);
    // Keep whatever rows already exist (e.g. re-opening after editing a
    // saved record, or nudging the count up/down), padding with blanks or
    // trimming to match the new total.
    setRows((prevRows) => {
      const base = prevRows.length ? prevRows : initialEmployees || [];
      const next = Array.from({ length: total }, (_, i) => ({
        ...EMPTY_ROW,
        ...base[i],
        dateOfResign: base[i]?.dateOfResign || entryDate || "",
      }));
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, total]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoadingOptions(true);
    Promise.all([
      getDesignations(),
      getDepartments(factoryId),
      getSections(),
      getResignationReasons(),
    ])
      .then(([d, dept, s, r]) => {
        if (cancelled) return;
        setDesignations(d || []);
        setDepartments(dept || []);
        setSections(s || []);
        setReasons(r || []);
      })
      .catch((err) => {
        if (!cancelled)
          setError(err.message || "Failed to load dropdown options.");
      })
      .finally(() => {
        if (!cancelled) setLoadingOptions(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, factoryId]);

  const updateRow = (index, field, value) => {
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    );
    setError("");
  };

  const completedCount = rows.filter(isRowComplete).length;
  const firstIncompleteIndex = rows.findIndex((row) => !isRowComplete(row));
  // Row indexes whose EPF No. collides with another row's - shown as an error
  // badge on the tab (rather than blocking as "incomplete", since both rows
  // otherwise have valid-looking data).
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
  const canSave = completedCount === rows.length && epfDuplicates.size === 0;

  const handleConfirm = () => {
    if (firstIncompleteIndex !== -1) {
      setActiveIndex(firstIncompleteIndex);
      setError(
        `Employee #${firstIncompleteIndex + 1}: please fill in every field before saving.`,
      );
      return;
    }
    if (epfDuplicates.size > 0) {
      setActiveIndex([...epfDuplicates][0]);
      setError("Each resigned employee must have a unique EPF No.");
      return;
    }

    onSave(rows.map((row, i) => ({ ...row, isMo: i < rmo })));
    onClose();
  };

  const rowLabel = (i) => (i < rmo ? "MO" : "TMO");

  const optionsReady = useMemo(
    () =>
      designations.length ||
      departments.length ||
      sections.length ||
      reasons.length,
    [designations, departments, sections, reasons],
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-3xl mx-4 p-6 max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-800">
            {modalTitle}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="p-3 rounded-md mb-4 bg-blue-50 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-gray-600">
            Enter details for all <strong>{total}</strong> {employeeLabel}{" "}
            employee(s) - <strong>{rmo}</strong> MO, <strong>{rtmo}</strong>{" "}
            TMO. This cannot be saved without all fields filled in.
          </p>
          <span
            className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${
              completedCount === total
                ? "bg-green-100 text-green-700"
                : "bg-orange-soft text-[#89511d]"
            }`}
          >
            {completedCount} / {total} completed
          </span>
        </div>

        {!loadingOptions && !optionsReady && (
          <div className="bg-orange-soft border border-orange-200 text-[#89511d] px-3 py-2 rounded-md text-xs mb-4">
            No Designations/Departments/Sections/Resignation Reasons found yet -
            add them before continuing.
          </div>
        )}

        {/* Pagination-style tabs - one per resigned employee, so the popup
            shows one employee's form at a time instead of a long scrolling
            list. A red dot marks a tab that's still missing required fields
            or has a duplicate EPF No., so it's obvious which ones still need
            attention before Save Details is enabled. */}
        <div className="flex flex-wrap gap-2 mb-4">
          {rows.map((row, i) => {
            const complete = isRowComplete(row) && !epfDuplicates.has(i);
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
                title={`Employee #${i + 1} (${rowLabel(i)}) - ${complete ? "complete" : "incomplete"}`}
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
          {rows[activeIndex] && (
            <div className="border border-gray-200 rounded-md p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="col-span-full flex items-center justify-between -mt-1 mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-700">
                    Employee #{activeIndex + 1}
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-teal-soft text-teal-dark">
                    {rowLabel(activeIndex)}
                  </span>
                </div>
              </div>

              {isTransfer && rowLabel(activeIndex) === "TMO" && (
                <Field label="Outcome" className="col-span-full">
                  <select
                    className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={rows[activeIndex].promotedToMo ? "stay" : "leave"}
                    onChange={(e) =>
                      updateRow(
                        activeIndex,
                        "promotedToMo",
                        e.target.value === "stay",
                      )
                    }
                  >
                    <option value="leave">Transferred out - leaves this carder</option>
                    <option value="stay">
                      Promoted to MO - stays in this carder
                    </option>
                  </select>
                  <p className="text-[11px] text-gray-500 mt-1">
                    Promoted to MO moves them from Allocated_Current TMO to
                    MO instead of removing them from this carder.
                  </p>
                </Field>
              )}

              <Field label="EPF No.">
                <input
                  type="text"
                  className={`w-full px-2.5 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    epfDuplicates.has(activeIndex)
                      ? "border-red-400"
                      : "border-gray-300"
                  }`}
                  value={rows[activeIndex].epf}
                  onChange={(e) =>
                    updateRow(activeIndex, "epf", e.target.value)
                  }
                />
                {epfDuplicates.has(activeIndex) && (
                  <p className="text-[11px] text-red-600 mt-1">
                    Duplicate EPF No. - each employee must be unique.
                  </p>
                )}
              </Field>

              <Field label="Name">
                <input
                  type="text"
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={rows[activeIndex].employeeName}
                  onChange={(e) =>
                    updateRow(activeIndex, "employeeName", e.target.value)
                  }
                />
              </Field>

              <Field label="Designation">
                <select
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={rows[activeIndex].designationId}
                  onChange={(e) =>
                    updateRow(activeIndex, "designationId", e.target.value)
                  }
                >
                  <option value="">Select…</option>
                  {designations.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.designation}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Department">
                <select
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={rows[activeIndex].departmentId}
                  onChange={(e) =>
                    updateRow(activeIndex, "departmentId", e.target.value)
                  }
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
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={rows[activeIndex].sectionId}
                  onChange={(e) =>
                    updateRow(activeIndex, "sectionId", e.target.value)
                  }
                >
                  <option value="">Select…</option>
                  {sections.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.sectionName}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Date of Joining">
                <input
                  type="date"
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={rows[activeIndex].dateOfJoin}
                  onChange={(e) =>
                    updateRow(activeIndex, "dateOfJoin", e.target.value)
                  }
                />
              </Field>

              <Field label="Date of Resign">
                <input
                  type="date"
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={rows[activeIndex].dateOfResign}
                  onChange={(e) =>
                    updateRow(activeIndex, "dateOfResign", e.target.value)
                  }
                />
              </Field>

              <Field label="Service Period">
                <input
                  type="text"
                  readOnly
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-300 bg-gray-50 rounded-md"
                  value={computeServicePeriod(
                    rows[activeIndex].dateOfJoin,
                    rows[activeIndex].dateOfResign,
                  )}
                />
              </Field>

              <Field
                label="Reason for Resign"
                className="col-span-full sm:col-span-2"
              >
                <select
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={rows[activeIndex].resignationReasonId}
                  onChange={(e) =>
                    updateRow(
                      activeIndex,
                      "resignationReasonId",
                      e.target.value,
                    )
                  }
                >
                  <option value="">Select…</option>
                  {reasons.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.resignedReason}
                    </option>
                  ))}
                </select>
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
            title={
              canSave
                ? undefined
                : "Fill in every employee's details (see the marked tabs) before saving."
            }
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
      <label className="block text-xs font-medium text-gray-700 mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}
