import { useEffect, useMemo, useState } from "react";
import Button from "../../../components/ui/Button";
import { getDesignations } from "../../../services/designationServices";
import { getDepartments } from "../../../services/departmentServices";
import { getSections } from "../../../services/sectionServices";
import { deleteResignedEmployee as deleteResignedEmployeeApi } from "../../../services/dailyCadreServices";
import { tcTransferTypeLabel } from "./TcTransferEmployeesModal";

/**
 * Opened via the eye icon next to the Training Center's Transfer to Pro Line
 * field - lists everyone on file for it, with a Delete per row. Mirrors
 * ResignedEmployeesListModal: on a saved entry (`batchId`) Delete hits the
 * server, which removes the employee and re-persists the batch (so Transfer
 * to Pro Line and Released from Tr. Cen. drop to match); on an unsaved entry
 * the row is just dropped from the form. `onChange(rows, tcTransfer)` hands
 * the caller the remaining rows and the new count.
 */
export default function TcTransferListModal({
  isOpen,
  onClose,
  employees,
  tcTransfer,
  factoryId,
  batchId,
  onChange,
  onDeleted,
}) {
  const [error, setError] = useState("");
  const [deletingEpf, setDeletingEpf] = useState(null);
  const [designations, setDesignations] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [sections, setSections] = useState([]);

  useEffect(() => {
    if (!isOpen) return;
    setError("");
    let cancelled = false;
    Promise.all([getDesignations(), getDepartments(factoryId), getSections()])
      .then(([d, dept, s]) => {
        if (cancelled) return;
        setDesignations(d || []);
        setDepartments(dept || []);
        setSections(s || []);
      })
      .catch(() => {
        // Labels are a display nicety - fall back to raw ids below.
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, factoryId]);

  const nameOf = (list, key) => {
    const map = new Map(list.map((x) => [String(x.id), x[key]]));
    return (id) => (id ? map.get(String(id)) || `#${id}` : "-");
  };
  const designationName = useMemo(() => nameOf(designations, "designation"), [designations]);
  const departmentName = useMemo(() => nameOf(departments, "departmentName"), [departments]);
  const sectionName = useMemo(() => nameOf(sections, "sectionName"), [sections]);

  const handleDelete = async (emp) => {
    if (deletingEpf) return;
    if (
      !window.confirm(
        `Permanently delete ${emp.employeeName || "this employee"} (EPF ${emp.epf}) from the Training Center transfers? This cannot be undone.`,
      )
    )
      return;

    const remaining = employees.filter((e) => e.epf !== emp.epf);
    if (batchId) {
      setDeletingEpf(emp.epf);
      setError("");
      let result;
      try {
        result = await deleteResignedEmployeeApi(batchId, emp.epf);
      } catch (err) {
        setError(err.message || "Failed to delete this employee.");
        setDeletingEpf(null);
        return;
      }
      setDeletingEpf(null);
      onChange(remaining, result.tct);
      onDeleted?.();
      return;
    }
    onChange(remaining, Math.max(0, tcTransfer - 1));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-4xl mx-4 p-6 max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-800">Training Center Transfers</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          Currently on file for this entry - <strong>{tcTransfer}</strong> transferred. Deleting someone here removes
          them for good{batchId ? " and updates the counts above straight away" : ""}.
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-md text-sm mb-4">
            {error}
          </div>
        )}

        <div className="overflow-auto flex-1 -mx-1 px-1">
          {employees.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400 border border-dashed border-gray-300 rounded-md">
              No Training Center transfers on file.
            </div>
          ) : (
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-600 text-left">
                  {["Transfer Type", "EPF No.", "Name", "Old Designation", "New Designation", "Department", "Section", "Effective Date", "Action"].map(
                    (h) => (
                      <th key={h} className="p-2 border border-slate-200">
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => (
                  <tr key={emp.epf} className="hover:bg-sky-50">
                    <td className="p-2 border border-slate-200">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-teal-soft text-teal-dark">
                        {tcTransferTypeLabel(emp.tcTransferType)}
                      </span>
                    </td>
                    <td className="p-2 border border-slate-200">{emp.epf}</td>
                    <td className="p-2 border border-slate-200">{emp.employeeName}</td>
                    <td className="p-2 border border-slate-200">{designationName(emp.designationId)}</td>
                    <td className="p-2 border border-slate-200">{designationName(emp.newDesignationId)}</td>
                    <td className="p-2 border border-slate-200">{departmentName(emp.departmentId)}</td>
                    <td className="p-2 border border-slate-200">{sectionName(emp.sectionId)}</td>
                    <td className="p-2 border border-slate-200">{emp.dateOfResign || "-"}</td>
                    <td className="p-2 border border-slate-200">
                      <Button variant="delete" small disabled={deletingEpf !== null} onClick={() => handleDelete(emp)}>
                        {deletingEpf === emp.epf ? "Deleting…" : "Delete"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex justify-end mt-6">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
