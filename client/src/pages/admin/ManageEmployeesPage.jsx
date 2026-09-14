import { useEffect, useState } from "react";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import { CountBadge } from "../../components/ui/Badge";
import { FieldInput, FieldSelect } from "../../components/ui/FormField";
import Swal from "sweetalert2";
import { CiEdit } from "react-icons/ci";
import { MdDeleteForever } from "react-icons/md";
import { getDesignations } from "../../services/designationServices";
import { getDepartments } from "../../services/departmentServices";
import { getSections } from "../../services/sectionServices";
import { getResignationReasons } from "../../services/resignationReasonServices";
import {
  getEmployees,
  createEmployee,
  editEmployee,
  deleteEmployee,
} from "../../services/employeeServices";

const EMPTY_FORM = {
  epf: "",
  employeeName: "",
  designationId: "",
  departmentId: "",
  sectionId: "",
  dateOfJoin: "",
  dateOfResign: "",
  resignationReasonId: "",
};

const RECENT_LIMIT = 10;

const formatDate = (date) => {
  if (!date) return "-";
  const parsed = new Date(`${date}T00:00:00`);
  if (isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

/**
 * Manage Employees (Employee Master) - admin-only page: shows the 10 most
 * recently added employees by default, lets the admin search for any other
 * employee by EPF number, and create/edit/delete employee details. Route is
 * gated by <ProtectedRoute roles={["Administrator"]} /> in AppRoutes; the
 * server independently enforces the same restriction on every /employees
 * write (and read) call.
 */
const ManageEmployeesPage = () => {
  const [employees, setEmployees] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [sections, setSections] = useState([]);
  const [resignationReasons, setResignationReasons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);
  const refetch = () => setReloadToken((n) => n + 1);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState(""); // debounced value actually queried

  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  // Debounce the EPF search box so we're not firing a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Reference lists for the form's dropdowns - loaded once.
  useEffect(() => {
    let cancelled = false;
    async function loadReferenceData() {
      try {
        const [designationList, departmentList, sectionList, reasonList] =
          await Promise.all([
            getDesignations(),
            getDepartments(),
            getSections(),
            getResignationReasons(),
          ]);
        if (!cancelled) {
          setDesignations(designationList);
          setDepartments(departmentList);
          setSections(sectionList);
          setResignationReasons(reasonList);
        }
      } catch (error) {
        if (!cancelled) {
          Swal.fire({
            title: "Error!",
            text: error.message || "Failed to load form options.",
            icon: "error",
            confirmButtonText: "OK",
          });
        }
      }
    }
    loadReferenceData();
    return () => {
      cancelled = true;
    };
  }, []);

  // The employee list itself - recently added by default, or EPF search results.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const list = await getEmployees(
          search ? { search } : { limit: RECENT_LIMIT },
        );
        if (!cancelled) setEmployees(list);
      } catch (error) {
        if (!cancelled) {
          Swal.fire({
            title: "Error!",
            text: error.message || "Failed to load employees.",
            icon: "error",
            confirmButtonText: "OK",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [reloadToken, search]);

  const resetForm = () => {
    setForm({ ...EMPTY_FORM });
    setEditingId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.epf.trim()) {
      Swal.fire({
        title: "Validation Error",
        text: "EPF Number is required.",
        icon: "error",
        confirmButtonText: "OK",
      });
      return;
    }
    if (!form.employeeName.trim()) {
      Swal.fire({
        title: "Validation Error",
        text: "Employee Name is required.",
        icon: "error",
        confirmButtonText: "OK",
      });
      return;
    }
    if (!form.designationId || !form.departmentId || !form.sectionId) {
      Swal.fire({
        title: "Validation Error",
        text: "Designation, Department and Section are required.",
        icon: "error",
        confirmButtonText: "OK",
      });
      return;
    }
    if (!form.dateOfJoin) {
      Swal.fire({
        title: "Validation Error",
        text: "Date of Join is required.",
        icon: "error",
        confirmButtonText: "OK",
      });
      return;
    }
    if (form.dateOfResign && form.dateOfResign < form.dateOfJoin) {
      Swal.fire({
        title: "Validation Error",
        text: "Date of Resign cannot be before Date of Join.",
        icon: "error",
        confirmButtonText: "OK",
      });
      return;
    }

    if (isSubmitting) return;
    setIsSubmitting(true);

    const payload = {
      epf: form.epf.trim(),
      employeeName: form.employeeName.trim(),
      designationId: Number(form.designationId),
      departmentId: Number(form.departmentId),
      sectionId: Number(form.sectionId),
      dateOfJoin: form.dateOfJoin,
      dateOfResign: form.dateOfResign || null,
      resignationReasonId: form.resignationReasonId
        ? Number(form.resignationReasonId)
        : null,
    };

    try {
      if (!editingId) {
        await createEmployee(payload);
        Swal.fire({
          title: "Success!",
          text: "Employee created successfully.",
          icon: "success",
          timer: 2000,
          showConfirmButton: false,
        });
      } else {
        await editEmployee(editingId, payload);
        Swal.fire({
          title: "Success!",
          text: "Employee updated successfully.",
          icon: "success",
          timer: 2000,
          showConfirmButton: false,
        });
      }
      resetForm();
      setShowForm(false);
      refetch();
    } catch (error) {
      Swal.fire({
        title: "Error!",
        text: error.message || "Something went wrong. Please try again.",
        icon: "error",
        confirmButtonText: "OK",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (row) => {
    setForm({
      epf: row.epf || "",
      employeeName: row.employeeName || "",
      designationId: row.designationId ? String(row.designationId) : "",
      departmentId: row.departmentId ? String(row.departmentId) : "",
      sectionId: row.sectionId ? String(row.sectionId) : "",
      dateOfJoin: row.dateOfJoin || "",
      dateOfResign: row.dateOfResign || "",
      resignationReasonId: row.resignationReasonId
        ? String(row.resignationReasonId)
        : "",
    });
    setEditingId(row.id);
    setShowForm(true);
  };

  const handleCancel = () => {
    const isDirty = Object.keys(EMPTY_FORM).some((key) => form[key]);
    if (isDirty) {
      Swal.fire({
        title: "Discard changes?",
        text: "You have unsaved changes. Are you sure you want to cancel?",
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "Yes, discard",
        cancelButtonText: "No, continue editing",
      }).then((result) => {
        if (result.isConfirmed) {
          resetForm();
          setShowForm(false);
        }
      });
    } else {
      resetForm();
      setShowForm(false);
    }
  };

  const handleDelete = async (row) => {
    const { isConfirmed } = await Swal.fire({
      title: `Delete '${row.employeeName}' (${row.epf})?`,
      text: "This action cannot be undone!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Delete",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
    });
    if (!isConfirmed) return;

    setDeletingId(row.id);
    try {
      await deleteEmployee(row.id);
      Swal.fire({
        title: "Deleted!",
        text: `'${row.employeeName}' has been deleted.`,
        icon: "success",
        timer: 2000,
        showConfirmButton: false,
      });
      if (editingId === row.id) {
        resetForm();
        setShowForm(false);
      }
      refetch();
    } catch (error) {
      Swal.fire({
        title: "Error!",
        text: error.message || "Failed to delete employee.",
        icon: "error",
        confirmButtonText: "OK",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const isSearching = Boolean(search);

  return (
    <div className="p-4">
      <div className="flex justify-end mb-4">
        {/* {{!showForm && (
          <Button
            variant="primary"
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
          >
            + Add Employee
          </Button>
        )}} */}
      </div>

      {showForm && (
        <Card
          title={editingId ? "Edit Employee" : "Add New Employee"}
          variant="navy"
        >
          <form className="p-4 grid gap-y-3" onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FieldInput
                label="EPF Number"
                placeholder="e.g., 1234"
                value={form.epf}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, epf: e.target.value }))
                }
              />
              <div className="md:col-span-2">
                <FieldInput
                  label="Employee Name"
                  placeholder="e.g., A. B. Perera"
                  value={form.employeeName}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      employeeName: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FieldSelect
                label="Designation"
                value={form.designationId}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    designationId: e.target.value,
                  }))
                }
              >
                <option value="">Select Designation</option>
                {designations.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.designation}
                  </option>
                ))}
              </FieldSelect>

              <FieldSelect
                label="Department"
                value={form.departmentId}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, departmentId: e.target.value }))
                }
              >
                <option value="">Select Department</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.departmentName}
                    {d.factory?.factoryName
                      ? ` (${d.factory.factoryName})`
                      : ""}
                  </option>
                ))}
              </FieldSelect>

              <FieldSelect
                label="Section"
                value={form.sectionId}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, sectionId: e.target.value }))
                }
              >
                <option value="">Select Section</option>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.sectionName}
                  </option>
                ))}
              </FieldSelect>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FieldInput
                label="Date of Join"
                type="date"
                value={form.dateOfJoin}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, dateOfJoin: e.target.value }))
                }
              />
              <FieldInput
                label="Date of Resign (optional)"
                type="date"
                value={form.dateOfResign}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, dateOfResign: e.target.value }))
                }
              />
              <FieldSelect
                label="Resignation Reason (optional)"
                value={form.resignationReasonId}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    resignationReasonId: e.target.value,
                  }))
                }
                disabled={!form.dateOfResign}
              >
                <option value="">Select Reason</option>
                {resignationReasons.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.resignedReason}
                  </option>
                ))}
              </FieldSelect>
            </div>

            <div className="mt-4 flex gap-4 justify-end">
              <Button
                type="button"
                onClick={handleCancel}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={isSubmitting}
                className="min-w-[100px]"
              >
                {isSubmitting
                  ? editingId
                    ? "Updating..."
                    : "Saving..."
                  : editingId
                    ? "Update"
                    : "Save"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      <div className="mt-4 rounded-md">
        <Card
          title={
            isSearching
              ? `Search Results for "${search}"`
              : "Recently Added Employees"
          }
          variant="navy"
          actions={
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search by EPF number…"
                className="rounded border border-white/40 bg-white/10 px-2 py-1 text-white text-xs placeholder-white/60 focus:outline-none focus:ring-1 focus:ring-white w-44"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => setSearchInput("")}
                  className="text-white/70 hover:text-white text-xs underline cursor-pointer"
                >
                  Clear
                </button>
              )}
              <CountBadge>
                {employees.length} employee{employees.length === 1 ? "" : "s"}
              </CountBadge>
            </div>
          }
        >
          <div className="p-4 overflow-auto">
            {loading ? (
              <div className="text-center text-sm text-slate-400 py-10">
                Loading employees...
              </div>
            ) : employees.length === 0 ? (
              <div className="text-center text-sm text-slate-400 py-10">
                {isSearching
                  ? `No employees found matching EPF "${search}".`
                  : 'No employees found. Click "Add Employee" to create one.'}
              </div>
            ) : (
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-gray-500 border-b border-gray-200">
                    <th className="py-2 pr-3">EPF Number</th>
                    <th className="py-2 pr-3">Employee Name</th>
                    <th className="py-2 pr-3">Designation</th>
                    <th className="py-2 pr-3">Department</th>
                    <th className="py-2 pr-3">Section</th>
                    <th className="py-2 pr-3">Date of Join</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-gray-200 hover:bg-gray-50 transition-colors"
                    >
                      <td className="py-2.5 pr-3 font-medium text-gray-800">
                        {row.epf}
                      </td>
                      <td className="py-2.5 pr-3 text-gray-700">
                        {row.employeeName}
                      </td>
                      <td className="py-2.5 pr-3 text-gray-600">
                        {row.designation?.designation || "-"}
                      </td>
                      <td className="py-2.5 pr-3 text-gray-600">
                        {row.department?.departmentName || "-"}
                      </td>
                      <td className="py-2.5 pr-3 text-gray-600">
                        {row.section?.sectionName || "-"}
                      </td>
                      <td className="py-2.5 pr-3 text-gray-500 text-xs">
                        {formatDate(row.dateOfJoin)}
                      </td>
                      <td className="py-2.5 pr-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${
                            row.dateOfResign
                              ? "bg-orange-soft text-[#89511d]"
                              : "bg-green-soft text-green-dark"
                          }`}
                        >
                          {row.dateOfResign ? "Resigned" : "Active"}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3">
                        <div className="flex gap-2 justify-center">
                          <button
                            className="py-1.5 px-2.5 bg-blue-50 rounded-sm border border-blue-200 cursor-pointer hover:bg-blue-100 duration-200"
                            onClick={() => handleEdit(row)}
                            title="Edit employee"
                          >
                            <CiEdit size={18} color="#2563eb" />
                          </button>
                          {/* <button
                            className="py-1.5 px-2.5 bg-red-50 rounded-sm border border-red-200 cursor-pointer hover:bg-red-100 duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            onClick={() => handleDelete(row)}
                            disabled={deletingId === row.id}
                            title="Delete employee"
                          >
                            <MdDeleteForever size={18} color="#dc2626" />
                          </button> */} 
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default ManageEmployeesPage;
