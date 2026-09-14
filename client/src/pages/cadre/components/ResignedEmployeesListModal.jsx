import { useEffect, useMemo, useState } from "react";
import Button from "../../../components/ui/Button";
import { getDesignations } from "../../../services/designationServices";
import { getDepartments } from "../../../services/departmentServices";
import { getSections } from "../../../services/sectionServices";
import { getResignationReasons } from "../../../services/resignationReasonServices";
import { deleteResignedEmployee as deleteResignedEmployeeApi } from "../../../services/dailyCadreServices";

/** "2y 3m" from two yyyy-mm-dd strings, or "-" while either is missing/invalid. */
function computeServicePeriod(dateOfJoin, dateOfResign) {
  if (!dateOfJoin || !dateOfResign) return "-";
  const start = new Date(`${dateOfJoin}T00:00:00`);
  const end = new Date(`${dateOfResign}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return "-";

  let years = end.getFullYear() - start.getFullYear();
  let months = end.getMonth() - start.getMonth();
  if (end.getDate() < start.getDate()) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  return `${years}y ${months}m`;
}

/**
 * Opened via the eye icon next to the Resigned/Terminated MO/TMO fields
 * (see CadreDetailsCard.jsx) - a plain, always-available view of everyone
 * currently on file as resigned/terminated for this entry, with a Delete
 * button per row. This is the only place employees actually get removed;
 * the Add popup (ResignedEmployeesModal.jsx) only ever adds new ones.
 *
 * When `batchId` is set (editing an already-saved daily entry) and the row
 * came from that saved record, Delete hits the server immediately -
 * permanently deleting the Employee record itself (not just unlinking it -
 * see deleteResignedEmployee in dailyCadreServices.js) and returning the
 * batch's freshly recomputed Resigned MO/TMO counts, which are applied here
 * right away. A row that was only added to the form this session and never
 * saved yet (no batchId, or added after this popup's initialEmployees
 * snapshot) has nothing to delete server-side, so it's just dropped locally
 * and the matching count decremented directly.
 */
export default function ResignedEmployeesListModal({
  isOpen,
  onClose,
  employees,
  rmo,
  rtmo,
  factoryId,
  batchId,
  onEmployeesChange,
  onCountsChange,
  onDeleted,
}) {
  const [error, setError] = useState("");
  const [deletingEpf, setDeletingEpf] = useState(null);
  const [designations, setDesignations] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [sections, setSections] = useState([]);
  const [reasons, setReasons] = useState([]);

  useEffect(() => {
    if (!isOpen) return;
    setError("");
    let cancelled = false;
    Promise.all([getDesignations(), getDepartments(factoryId), getSections(), getResignationReasons()])
      .then(([d, dept, s, r]) => {
        if (cancelled) return;
        setDesignations(d || []);
        setDepartments(dept || []);
        setSections(s || []);
        setReasons(r || []);
      })
      .catch(() => {
        // Labels are a display nicety - if they fail to load, fall back to
        // showing raw ids below rather than blocking the view/delete flow.
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, factoryId]);

  const designationName = useMemo(() => {
    const map = new Map(designations.map((d) => [String(d.id), d.designation]));
    return (id) => map.get(String(id)) || `#${id}`;
  }, [designations]);
  const departmentName = useMemo(() => {
    const map = new Map(departments.map((d) => [String(d.id), d.departmentName]));
    return (id) => map.get(String(id)) || `#${id}`;
  }, [departments]);
  const sectionName = useMemo(() => {
    const map = new Map(sections.map((s) => [String(s.id), s.sectionName]));
    return (id) => map.get(String(id)) || `#${id}`;
  }, [sections]);
  const reasonName = useMemo(() => {
    const map = new Map(reasons.map((r) => [String(r.id), r.resignedReason]));
    return (id) => (id ? map.get(String(id)) || `#${id}` : "-");
  }, [reasons]);

  const handleDelete = async (emp) => {
    if (deletingEpf) return;
    if (
      !window.confirm(
        `Permanently delete ${emp.employeeName || "this employee"} (EPF ${emp.epf}) from resigned employees? This cannot be undone.`,
      )
    )
      return;

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
      onEmployeesChange(employees.filter((e) => e.epf !== emp.epf));
      onCountsChange(result.rmo, result.rtmo);
      // The server just hard-deleted the employee and re-persisted this
      // batch's counts - refresh the Daily Data Records table so it doesn't
      // sit stale until the page is reloaded.
      onDeleted?.();
      return;
    }

    // Nothing in the database yet for this row (brand-new, unsaved daily
    // entry) - just drop it from the form and decrement the matching count.
    onEmployeesChange(employees.filter((e) => e.epf !== emp.epf));
    onCountsChange(emp.isMo ? Math.max(0, rmo - 1) : rmo, emp.isMo ? rtmo : Math.max(0, rtmo - 1));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-4xl mx-4 p-6 max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-800">Resigned / Terminated Employees</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          Currently on file for this entry - <strong>{rmo}</strong> MO, <strong>{rtmo}</strong> TMO. Deleting
          someone here removes them for good{batchId ? " and updates the counts above straight away" : ""}.
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-md text-sm mb-4">
            {error}
          </div>
        )}

        <div className="overflow-auto flex-1 -mx-1 px-1">
          {employees.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400 border border-dashed border-gray-300 rounded-md">
              No resigned employees on file.
            </div>
          ) : (
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-600 text-left">
                  <th className="p-2 border border-slate-200">Type</th>
                  <th className="p-2 border border-slate-200">EPF No.</th>
                  <th className="p-2 border border-slate-200">Name</th>
                  <th className="p-2 border border-slate-200">Designation</th>
                  <th className="p-2 border border-slate-200">Department</th>
                  <th className="p-2 border border-slate-200">Section</th>
                  <th className="p-2 border border-slate-200">Date of Join</th>
                  <th className="p-2 border border-slate-200">Date of Resign</th>
                  <th className="p-2 border border-slate-200">Service</th>
                  <th className="p-2 border border-slate-200">Reason</th>
                  <th className="p-2 border border-slate-200">Action</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => (
                  <tr key={emp.epf} className="hover:bg-sky-50">
                    <td className="p-2 border border-slate-200">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-teal-soft text-teal-dark">
                        {emp.isMo ? "MO" : "TMO"}
                      </span>
                    </td>
                    <td className="p-2 border border-slate-200">{emp.epf}</td>
                    <td className="p-2 border border-slate-200">{emp.employeeName}</td>
                    <td className="p-2 border border-slate-200">{designationName(emp.designationId)}</td>
                    <td className="p-2 border border-slate-200">{departmentName(emp.departmentId)}</td>
                    <td className="p-2 border border-slate-200">{sectionName(emp.sectionId)}</td>
                    <td className="p-2 border border-slate-200">{emp.dateOfJoin || "-"}</td>
                    <td className="p-2 border border-slate-200">{emp.dateOfResign || "-"}</td>
                    <td className="p-2 border border-slate-200">
                      {computeServicePeriod(emp.dateOfJoin, emp.dateOfResign)}
                    </td>
                    <td className="p-2 border border-slate-200">{reasonName(emp.resignationReasonId)}</td>
                    <td className="p-2 border border-slate-200">
                      <Button
                        variant="delete"
                        small
                        disabled={deletingEpf !== null}
                        onClick={() => handleDelete(emp)}
                      >
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
