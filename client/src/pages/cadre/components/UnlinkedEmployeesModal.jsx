import { useEffect, useMemo, useState } from "react";
import Button from "../../../components/ui/Button";
import { getUnlinkedResignedEmployees } from "../../../services/employeeServices";

/**
 * Opened via the "Unlinked Employees" button on the Daily Entry page
 * (Administrator/SuperUser only) - a view-only list of employees who still
 * have a Date of Resign but aren't tied to any Daily Data Entry any more
 * (see employeeService.listUnlinkedResignedEmployees). They no longer count
 * anywhere on the dashboard, so this is where to find them to re-add to the
 * right entry or clean up on the Manage Employees page. The parent only
 * mounts it while open, so each open starts fresh and refetches.
 */
export default function UnlinkedEmployeesModal({ onClose }) {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    getUnlinkedResignedEmployees()
      .then((rows) => {
        if (!cancelled) setEmployees(rows || []);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Failed to load unlinked employees.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Filters on EPF or name, same partial-match feel as Manage Employees' EPF search.
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return employees;
    return employees.filter(
      (emp) =>
        String(emp.epf).toLowerCase().includes(term) ||
        (emp.employeeName || "").toLowerCase().includes(term),
    );
  }, [employees, search]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-5xl mx-4 p-6 max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-800">Unlinked Employees</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <p className="text-sm text-gray-600">
            Employees with a Date of Resign that aren't on any Daily Data Entry - their entry was deleted or they were
            removed from it. They aren't counted on the dashboard.
          </p>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search EPF or name"
            className="rounded border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-teal"
          />
        </div>

        <div className="overflow-auto flex-1 -mx-1 px-1">
          {loading ? (
            <div className="p-8 text-center text-sm text-gray-400">Loading…</div>
          ) : error ? (
            <div className="p-8 text-center text-sm text-red-600 border border-dashed border-red-300 rounded-md">
              {error}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400 border border-dashed border-gray-300 rounded-md">
              {employees.length === 0 ? "No unlinked employees." : "No employees match your search."}
            </div>
          ) : (
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0">
                <tr className="bg-slate-100 text-slate-600 text-left">
                  <th className="p-2 border border-slate-200">EPF No.</th>
                  <th className="p-2 border border-slate-200">Name</th>
                  <th className="p-2 border border-slate-200">Designation</th>
                  <th className="p-2 border border-slate-200">Department</th>
                  <th className="p-2 border border-slate-200">Section</th>
                  <th className="p-2 border border-slate-200">Date of Join</th>
                  <th className="p-2 border border-slate-200">Date of Resign</th>
                  <th className="p-2 border border-slate-200">Reason</th>
                  <th className="p-2 border border-slate-200" title="When this record was last changed - usually when it was unlinked">
                    Last Updated
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((emp) => (
                  <tr key={emp.id} className="hover:bg-sky-50">
                    <td className="p-2 border border-slate-200">{emp.epf}</td>
                    <td className="p-2 border border-slate-200">{emp.employeeName}</td>
                    <td className="p-2 border border-slate-200">{emp.designation?.designation || "-"}</td>
                    <td className="p-2 border border-slate-200">{emp.department?.departmentName || "-"}</td>
                    <td className="p-2 border border-slate-200">{emp.section?.sectionName || "-"}</td>
                    <td className="p-2 border border-slate-200">{emp.dateOfJoin || "-"}</td>
                    <td className="p-2 border border-slate-200">{emp.dateOfResign || "-"}</td>
                    <td className="p-2 border border-slate-200">{emp.resignationReason?.resignedReason || "-"}</td>
                    <td className="p-2 border border-slate-200">
                      {emp.updatedAt ? new Date(emp.updatedAt).toLocaleString() : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex justify-between items-center mt-6">
          <span className="text-xs text-gray-500">
            {filtered.length} of {employees.length} employee{employees.length === 1 ? "" : "s"}
          </span>
          <Button variant="default" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
