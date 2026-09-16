import { useEffect, useState, useRef } from "react";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import { FieldInput } from "../../components/ui/FormField";
import Swal from "sweetalert2";
import { CiEdit } from "react-icons/ci";
import { MdDeleteForever } from "react-icons/md";
import {
  getResignationReasons,
  createResignationReason,
  editResignationReason,
  deleteResignationReason,
} from "../../services/resignationReasonServices";

const EMPTY_FORM = { resignedReason: "", transferRelated: false };

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

const ManageResignationReasonPage = () => {
  const [reasons, setReasons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);
  const refetch = () => setReloadToken((n) => n + 1);
  const rrInputRef = useRef();

  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const data = await getResignationReasons();
        if (!cancelled) setReasons(data);
      } catch (error) {
        if (!cancelled) {
          Swal.fire({
            title: "Error!",
            text: error.message || "Failed to load resignation reasons.",
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

    if (!form.resignedReason.trim()) {
      Swal.fire({
        title: "Validation Error",
        text: "Reason is required.",
        icon: "error",
        confirmButtonText: "OK",
      });
      return;
    }

    if (isSubmitting) return;
    setIsSubmitting(true);

    const payload = {
      resignedReason: form.resignedReason.trim(),
      transferRelated: !!form.transferRelated,
    };

    try {
      if (!editingId) {
        await createResignationReason(payload);
        Swal.fire({
          title: "Success!",
          text: "Resignation reason created successfully.",
          icon: "success",
          timer: 2000,
          showConfirmButton: false,
        });
      } else {
        await editResignationReason(editingId, payload);
        Swal.fire({
          title: "Success!",
          text: "Resignation reason updated successfully.",
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

  const handleEdit = (reason) => {
    setForm({
      resignedReason: reason.resignedReason || "",
      transferRelated: !!reason.transferRelated,
    });
    setEditingId(reason.id);
    setShowForm(true);
  };

  useEffect(() => {
    if (setEditingId && showForm) {
      if (rrInputRef.current) {
        rrInputRef.current.focus();
      }
    }
  }, [editingId]);

  const handleCancel = () => {
    if (form.resignedReason) {
      resetForm();
      setShowForm(false);
      // Swal.fire({
      //   title: "Discard changes?",
      //   text: "You have unsaved changes. Are you sure you want to cancel?",
      //   icon: "question",
      //   showCancelButton: true,
      //   confirmButtonText: "Yes, discard",
      //   cancelButtonText: "No, continue editing",
      // }).then((result) => {
      //   if (result.isConfirmed) {
      //   }
      // });
    } else {
      resetForm();
      setShowForm(false);
    }
  };

  const handleDelete = async (reason) => {
    const { isConfirmed } = await Swal.fire({
      title: `Delete '${reason.resignedReason}'?`,
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
      await deleteResignationReason(reason.id);
      Swal.fire({
        title: "Deleted!",
        text: `'${reason.resignedReason}' has been deleted.`,
        icon: "success",
        timer: 2000,
        showConfirmButton: false,
      });
      if (editingId === reason.id) {
        resetForm();
        setShowForm(false);
      }
      refetch();
    } catch (error) {
      Swal.fire({
        title: "Error!",
        text: error.message || "Failed to delete resignation reason.",
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
            + Add Reason
          </Button>
        )}
      </div>

      {showForm && (
        <Card
          title={editingId ? "Edit Reason" : "Add New Reason"}
          variant="navy"
        >
          <form className="p-4 grid gap-y-2" onSubmit={handleSubmit}>
            <div className="flex flex-wrap md:flex-nowrap gap-4 items-end">
              <div className="grow">
                <FieldInput
                  label="Resignation Reason"
                  placeholder="e.g., Higher Studies"
                  value={form.resignedReason}
                  ref={rrInputRef}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      resignedReason: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.transferRelated}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    transferRelated: e.target.checked,
                  }))
                }
              />
              Transfer related (shown only in the Transfer tile's Reason
              dropdown, not Resigned/Terminated)
            </label>

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
        </Card>
      )}

      <div className="mt-4 rounded-md">
        <Card title="Manage Resignation Reasons" variant="navy">
          <div className="p-4 overflow-auto">
            {loading ? (
              <div className="text-center text-sm text-slate-400 py-10">
                Loading resignation reasons...
              </div>
            ) : reasons.length === 0 ? (
              <div className="text-center text-sm text-slate-400 py-10">
                No resignation reasons found. Click "Add Reason" to create one.
              </div>
            ) : (
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-gray-500 border-b border-gray-200">
                    <th className="py-2 pr-3">Reason</th>
                    <th className="py-2 pr-3">Transfer Related</th>
                    <th className="py-2 pr-3">Created At</th>
                    <th className="py-2 pr-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {reasons.map((reason) => (
                    <tr
                      key={reason.id}
                      className="border-b border-gray-200 hover:bg-gray-50 transition-colors"
                    >
                      <td className="py-2.5 pr-3 font-medium text-gray-800">
                        {reason.resignedReason}
                      </td>
                      <td className="py-2.5 pr-3">
                        {reason.transferRelated ? (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-teal-soft text-teal-dark">
                            Transfer
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">-</span>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 text-gray-500 text-xs">
                        {visualizeDateTime(reason.createdAt)}
                      </td>
                      <td className="py-2.5 pr-3">
                        <div className="flex gap-2 justify-center">
                          <button
                            className="py-1.5 px-2.5 bg-blue-50 rounded-sm border border-blue-200 cursor-pointer hover:bg-blue-100 duration-200"
                            onClick={() => handleEdit(reason)}
                            title="Edit reason"
                          >
                            <CiEdit size={18} color="#2563eb" />
                          </button>
                          <button
                            className="py-1.5 px-2.5 bg-red-50 rounded-sm border border-red-200 cursor-pointer hover:bg-red-100 duration-200"
                            onClick={() => handleDelete(reason)}
                            title="Delete reason"
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

export default ManageResignationReasonPage;
