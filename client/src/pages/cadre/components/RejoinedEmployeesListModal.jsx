import { useEffect, useMemo, useState } from "react";
import Button from "../../../components/ui/Button";
import { getDesignations } from "../../../services/designationServices";
import { getDepartments } from "../../../services/departmentServices";
import { getSections } from "../../../services/sectionServices";

/**
 * Opened via the eye icon next to the Rejoined MO/TMO fields (see
 * CadreDetailsCard.jsx) - a plain, view-only list of everyone currently
 * credited as Rejoined on this daily entry (see
 * dailyCadreService.rejoinResignedEmployee / listRejoinedByBatchIds). No
 * Delete or Rejoin actions here - unlike ResignedEmployeesListModal.jsx,
 * there's nothing to undo from this view; the Resigned/Terminated tile's own
 * Rejoin button is the only way this list changes.
 */
export default function RejoinedEmployeesListModal({ isOpen, onClose, employees, rjmo, rjtmo }) {
  const [designations, setDesignations] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [sections, setSections] = useState([]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    Promise.all([getDesignations(), getDepartments(), getSections()])
      .then(([d, dept, s]) => {
        if (cancelled) return;
        setDesignations(d || []);
        setDepartments(dept || []);
        setSections(s || []);
      })
      .catch(() => {
        // Labels are a display nicety - if they fail to load, fall back to showing raw ids below.
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-4xl mx-4 p-6 max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-800">Rejoined Employees</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          Currently credited as Rejoined on this entry - <strong>{rjmo}</strong> MO, <strong>{rjtmo}</strong> TMO.
        </p>

        <div className="overflow-auto flex-1 -mx-1 px-1">
          {employees.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400 border border-dashed border-gray-300 rounded-md">
              No rejoined employees on file.
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
                  <th className="p-2 border border-slate-200">Date of Resign</th>
                  <th className="p-2 border border-slate-200">Date of Rejoin</th>
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
                    <td className="p-2 border border-slate-200">{emp.dateOfResign || "-"}</td>
                    <td className="p-2 border border-slate-200">{emp.dateOfRejoin || "-"}</td>
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
