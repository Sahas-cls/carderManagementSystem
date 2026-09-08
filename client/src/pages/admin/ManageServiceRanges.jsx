import { useEffect, useState } from "react";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import { FieldInput } from "../../components/ui/FormField";
import Swal from "sweetalert2";
import { CiEdit } from "react-icons/ci";
import { MdDeleteForever } from "react-icons/md";
import {
  getServiceRanges,
  createServiceRange,
  editServiceRange,
  deleteServiceRange,
} from "../../services/serviceRangeServices";

const EMPTY_FORM = { years: 0, months: 0 };

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

const ManageServiceRanges = () => {
  const [ranges, setRanges] = useState([]);
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
        const data = await getServiceRanges();
        if (!cancelled) setRanges(data);
      } catch (error) {
        if (!cancelled) {
          Swal.fire({
            title: "Error!",
            text: error.message || "Failed to load service ranges.",
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

    if (
      form.years === "" ||
      Number(form.years) < 0 ||
      !Number.isInteger(Number(form.years))
    ) {
      Swal.fire({
        title: "Validation Error",
        text: "Years must be a non-negative whole number.",
        icon: "error",
        confirmButtonText: "OK",
      });
      return;
    }
    if (
      form.months === "" ||
      Number(form.months) < 0 ||
      !Number.isInteger(Number(form.months))
    ) {
      Swal.fire({
        title: "Validation Error",
        text: "Months must be a non-negative whole number.",
        icon: "error",
        confirmButtonText: "OK",
      });
      return;
    }

    if (isSubmitting) return;
    setIsSubmitting(true);

    const payload = { years: Number(form.years), months: Number(form.months) };

    try {
      if (!editingId) {
        await createServiceRange(payload);
        Swal.fire({
          title: "Success!",
          text: "Service range created successfully.",
          icon: "success",
          timer: 2000,
          showConfirmButton: false,
        });
      } else {
        await editServiceRange(editingId, payload);
        Swal.fire({
          title: "Success!",
          text: "Service range updated successfully.",
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

  const handleEdit = (range) => {
    setForm({ years: String(range.years), months: String(range.months) });
    setEditingId(range.id);
    setShowForm(true);
  };

  const handleCancel = () => {
    if (form.years || form.months) {
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

  const handleDelete = async (range) => {
    const { isConfirmed } = await Swal.fire({
      title: `Delete '${range.years}y ${range.months}m' service range?`,
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
      await deleteServiceRange(range.id);
      Swal.fire({
        title: "Deleted!",
        text: "Service range has been deleted.",
        icon: "success",
        timer: 2000,
        showConfirmButton: false,
      });
      if (editingId === range.id) {
        resetForm();
        setShowForm(false);
      }
      refetch();
    } catch (error) {
      Swal.fire({
        title: "Error!",
        text: error.message || "Failed to delete service range.",
        icon: "error",
        confirmButtonText: "OK",
      });
    }
  };

  const getText = (year, month = 0) => {
    console.log("year", year, " month ", month);
    if (!year) {
      return `Less than ${month} ${month > 1 ? "months" : "month"}`;
    } else if (year) {
      return month <= 0
        ? `Less than ${year} ${year > 1 ? "years" : "year"}`
        : `Less than ${year} years and ${month} ${month > 1 ? "months" : "month"}`;
    }

    return "null";
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
            Add Service Range
          </Button>
        )}
      </div>

      {showForm && (
        <div className="w-full border p-6 rounded-md border-gray-300 shadow-md relative bg-white mb-6">
          <form onSubmit={handleSubmit}>
            <div className="flex flex-wrap md:flex-nowrap gap-4">
              <div className="grow md:grow-0 md:w-1/3">
                <FieldInput
                  label="Years"
                  type="number"
                  min="0"
                  placeholder="e.g., 1"
                  value={form.years}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, years: e.target.value }))
                  }
                />
              </div>

              <div className="grow md:grow-0 md:w-1/3">
                <FieldInput
                  label="Months"
                  type="number"
                  min="0"
                  placeholder="e.g., 6"
                  value={form.months}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, months: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="mt-6 flex gap-4 justify-end">
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
        </div>
      )}

      <div className="mt-4 p-4 rounded-md">
        <Card title="Manage Service Ranges" variant="navy">
          <div className="p-4 overflow-auto">
            {loading ? (
              <div className="text-center text-sm text-slate-400 py-10">
                Loading service ranges...
              </div>
            ) : ranges.length === 0 ? (
              <div className="text-center text-sm text-slate-400 py-10">
                No service ranges found. Click "Add Service Range" to create
                one.
              </div>
            ) : (
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-gray-500 border-b border-gray-200">
                    <th className="py-2 pr-3">Years</th>
                    <th className="py-2 pr-3">Months</th>
                    <th className="py-2 pr-3">Text</th>
                    <th className="py-2 pr-3">Created At</th>
                    <th className="py-2 pr-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {ranges.map((range) => (
                    <tr
                      key={range.id}
                      className="border-b border-gray-200 hover:bg-gray-50 transition-colors"
                    >
                      <td className="py-2.5 pr-3 font-medium text-gray-800">
                        {range.years}
                      </td>
                      <td className="py-2.5 pr-3 text-gray-600">
                        {range.months}
                      </td>
                      <td className="py-2.5 pr-3 font-medium text-gray-800">
                        {getText(range.years, range.months)}
                      </td>
                      <td className="py-2.5 pr-3 text-gray-500 text-xs">
                        {visualizeDateTime(range.createdAt)}
                      </td>
                      <td className="py-2.5 pr-3">
                        <div className="flex gap-2 justify-center">
                          <button
                            className="py-1.5 px-2.5 bg-blue-50 rounded-sm border border-blue-200 cursor-pointer hover:bg-blue-100 duration-200"
                            onClick={() => handleEdit(range)}
                            title="Edit service range"
                          >
                            <CiEdit size={18} color="#2563eb" />
                          </button>
                          <button
                            className="py-1.5 px-2.5 bg-red-50 rounded-sm border border-red-200 cursor-pointer hover:bg-red-100 duration-200"
                            onClick={() => handleDelete(range)}
                            title="Delete service range"
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

export default ManageServiceRanges;
