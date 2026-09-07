import { useEffect, useState } from "react";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import { FieldInput, FieldSelect } from "../../components/ui/FormField";
import Swal from "sweetalert2";
import { CiEdit } from "react-icons/ci";
import { MdDeleteForever } from "react-icons/md";
import { getFactories } from "../../services/factoryServices";
import {
  getDepartments,
  createDepartment,
  editDepartment,
  deleteDepartment,
} from "../../services/departmentServices";

const EMPTY_FORM = { factoryId: "", departmentName: "" };

const visualizeDateTime = (date) => {
  if (!date) return "";
  const value = String(date).trim().replace(" ", "T");
  const parsedDate = new Date(value);
  if (isNaN(parsedDate.getTime())) return "";
  return parsedDate.toLocaleString("en-US", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const ManageDepartmentPage = () => {
  const [departments, setDepartments] = useState([]);
  const [factories, setFactories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);
  const refetch = () => setReloadToken((n) => n + 1);

  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [departmentList, factoryList] = await Promise.all([getDepartments(), getFactories()]);
        if (!cancelled) {
          setDepartments(departmentList);
          setFactories(factoryList);
        }
      } catch (error) {
        if (!cancelled) {
          Swal.fire({
            title: "Error!",
            text: error.message || "Failed to load departments.",
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
  }, [reloadToken]);

  const resetForm = () => {
    setForm({ ...EMPTY_FORM });
    setEditingId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.factoryId) {
      Swal.fire({
        title: "Validation Error",
        text: "Factory is required.",
        icon: "error",
        confirmButtonText: "OK",
      });
      return;
    }
    if (!form.departmentName.trim()) {
      Swal.fire({
        title: "Validation Error",
        text: "Department Name is required.",
        icon: "error",
        confirmButtonText: "OK",
      });
      return;
    }

    if (isSubmitting) return;
    setIsSubmitting(true);

    const payload = { factoryId: Number(form.factoryId), departmentName: form.departmentName.trim() };

    try {
      if (!editingId) {
        await createDepartment(payload);
        Swal.fire({
          title: "Success!",
          text: "Department created successfully.",
          icon: "success",
          timer: 2000,
          showConfirmButton: false,
        });
      } else {
        await editDepartment(editingId, payload);
        Swal.fire({
          title: "Success!",
          text: "Department updated successfully.",
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
      factoryId: row.factoryId ? String(row.factoryId) : "",
      departmentName: row.departmentName || "",
    });
    setEditingId(row.id);
    setShowForm(true);
  };

  const handleCancel = () => {
    if (form.factoryId || form.departmentName) {
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
      title: `Delete '${row.departmentName}'?`,
      text: "This action cannot be undone!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Delete",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
    });
    if (!isConfirmed) return;

    try {
      await deleteDepartment(row.id);
      Swal.fire({
        title: "Deleted!",
        text: `'${row.departmentName}' has been deleted.`,
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
        text: error.message || "Failed to delete department.",
        icon: "error",
        confirmButtonText: "OK",
      });
    }
  };

  return (
    <div className="p-4">
      <div className="flex justify-end mb-4">
        {!showForm && (
          <Button
            variant="primary"
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
          >
            + Add Department
          </Button>
        )}
      </div>

      {showForm && (
        <Card title={editingId ? "Edit Department" : "Add New Department"} variant="navy">
          <form className="p-4 grid gap-y-2" onSubmit={handleSubmit}>
            <div className="flex flex-wrap md:flex-nowrap gap-4 items-end">
              <div className="grow md:grow-0 md:w-1/3">
                <FieldSelect
                  label="Factory"
                  value={form.factoryId}
                  onChange={(e) => setForm((prev) => ({ ...prev, factoryId: e.target.value }))}
                >
                  <option value="">Select Factory</option>
                  {factories.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.factoryName}
                    </option>
                  ))}
                </FieldSelect>
              </div>

              <div className="grow">
                <FieldInput
                  label="Department Name"
                  placeholder="e.g., Cutting"
                  value={form.departmentName}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, departmentName: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="mt-6 flex gap-4 justify-end">
              <Button type="button" onClick={handleCancel} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={isSubmitting} className="min-w-[100px]">
                {isSubmitting ? (editingId ? "Updating..." : "Saving...") : editingId ? "Update" : "Save"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      <div className="mt-4 rounded-md">
        <Card title="Manage Departments" variant="navy">
          <div className="p-4 overflow-auto">
            {loading ? (
              <div className="text-center text-sm text-slate-400 py-10">Loading departments...</div>
            ) : departments.length === 0 ? (
              <div className="text-center text-sm text-slate-400 py-10">
                No departments found. Click "Add Department" to create one.
              </div>
            ) : (
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-gray-500 border-b border-gray-200">
                    <th className="py-2 pr-3">Factory</th>
                    <th className="py-2 pr-3">Department Name</th>
                    <th className="py-2 pr-3">Created At</th>
                    <th className="py-2 pr-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {departments.map((row) => (
                    <tr key={row.id} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                      <td className="py-2.5 pr-3 text-gray-600">{row.factory?.factoryName || "-"}</td>
                      <td className="py-2.5 pr-3 font-medium text-gray-800">{row.departmentName}</td>
                      <td className="py-2.5 pr-3 text-gray-500 text-xs">{visualizeDateTime(row.createdAt)}</td>
                      <td className="py-2.5 pr-3">
                        <div className="flex gap-2 justify-center">
                          <button
                            className="py-1.5 px-2.5 bg-blue-50 rounded-sm border border-blue-200 cursor-pointer hover:bg-blue-100 duration-200"
                            onClick={() => handleEdit(row)}
                            title="Edit department"
                          >
                            <CiEdit size={18} color="#2563eb" />
                          </button>
                          <button
                            className="py-1.5 px-2.5 bg-red-50 rounded-sm border border-red-200 cursor-pointer hover:bg-red-100 duration-200"
                            onClick={() => handleDelete(row)}
                            title="Delete department"
                          >
                            <MdDeleteForever size={18} color="#dc2626" />
                          </button>
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

export default ManageDepartmentPage;
