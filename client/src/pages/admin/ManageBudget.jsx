import { useEffect, useState } from "react";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import { FieldInput, FieldSelect } from "../../components/ui/FormField";
import useDailyCadreRecords from "../../hooks/useDailyCadreRecords";
import useAuth from "../../hooks/useAuth";
import Swal from "sweetalert2";
import { CiEdit } from "react-icons/ci";
import { MdDeleteForever } from "react-icons/md";
import {
  getBudgets,
  createBudget,
  editBudget,
  deleteBudget,
  setBudgetStatus,
} from "../../services/budgetServices";

const EMPTY_FORM = { factoryId: "", moCount: "", tmoCount: "" };

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

const ManageBudget = () => {
  const { user } = useAuth();
  const userFactoryId = user?.factory?.id ? String(user.factory.id) : "";

  // Factory list (reused across admin pages).
  const { factories } = useDailyCadreRecords();

  // Which factory's budget history is shown below - defaults to the admin's own factory if they have one.
  const [filterFactoryId, setFilterFactoryId] = useState(userFactoryId);

  const [budgets, setBudgets] = useState([]);
  const [loadingBudgets, setLoadingBudgets] = useState(true);
  const [statusUpdatingId, setStatusUpdatingId] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);
  const refetchBudgets = () => setReloadToken((n) => n + 1);

  // Add/edit form state.
  const [form, setForm] = useState({ ...EMPTY_FORM, factoryId: userFactoryId });
  const [editingId, setEditingId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Toggle form visibility
  const [showForm, setShowForm] = useState(false);

  const total = (Number(form.moCount) || 0) + (Number(form.tmoCount) || 0);

  // NOTE FETCH - budgets for the factory currently selected in the filter (or every factory when none is picked)
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadingBudgets(true);
      try {
        const data = await getBudgets(filterFactoryId || undefined);
        if (!cancelled) setBudgets(data);
      } catch (error) {
        if (!cancelled) {
          Swal.fire({
            title: "Error!",
            text: error.message || "Failed to load budgets.",
            icon: "error",
            confirmButtonText: "OK",
          });
        }
      } finally {
        if (!cancelled) setLoadingBudgets(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [filterFactoryId, reloadToken]);

  const resetForm = () => {
    setForm({ ...EMPTY_FORM, factoryId: userFactoryId });
    setEditingId(null);
    // Don't set showForm here - let the caller control it
  };

  const handleFieldChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.factoryId) {
      Swal.fire({
        title: "Validation Error",
        text: "Please select a factory.",
        icon: "error",
        confirmButtonText: "OK",
      });
      return;
    }
    if (form.moCount === "" || Number(form.moCount) < 0) {
      Swal.fire({
        title: "Validation Error",
        text: "MO must be a non-negative number.",
        icon: "error",
        confirmButtonText: "OK",
      });
      return;
    }
    if (form.tmoCount === "" || Number(form.tmoCount) < 0) {
      Swal.fire({
        title: "Validation Error",
        text: "TMO must be a non-negative number.",
        icon: "error",
        confirmButtonText: "OK",
      });
      return;
    }

    if (isSubmitting) return;
    setIsSubmitting(true);

    const payload = {
      factoryId: form.factoryId,
      moCount: Number(form.moCount),
      tmoCount: Number(form.tmoCount),
    };

    try {
      if (!editingId) {
        await createBudget(payload);
        Swal.fire({
          title: "Success!",
          text: "Budget created successfully.",
          icon: "success",
          timer: 2000,
          showConfirmButton: false,
        });
      } else {
        await editBudget(editingId, payload);
        Swal.fire({
          title: "Success!",
          text: "Budget updated successfully.",
          icon: "success",
          timer: 2000,
          showConfirmButton: false,
        });
      }
      resetForm();
      setShowForm(false); // Hide form after successful submit
      refetchBudgets();
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

  const handleEdit = (budget) => {
    setForm({
      factoryId: String(budget.factoryId),
      moCount: String(budget.moCount),
      tmoCount: String(budget.tmoCount),
    });
    setEditingId(budget.id);
    setShowForm(true); // Show form when editing
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCancelEdit = () => {
    resetForm();
    setShowForm(false); // Hide form on cancel
  };

  const handleDelete = async (budget) => {
    const { isConfirmed } = await Swal.fire({
      title: `Delete this budget for '${budget.factory?.factoryName || "this factory"}'?`,
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
      await deleteBudget(budget.id);
      Swal.fire({
        title: "Deleted!",
        text: "Budget has been deleted.",
        icon: "success",
        timer: 2000,
        showConfirmButton: false,
      });
      if (editingId === budget.id) {
        resetForm();
        setShowForm(false);
      }
      refetchBudgets();
    } catch (error) {
      Swal.fire({
        title: "Error!",
        text: error.message || "Failed to delete budget.",
        icon: "error",
        confirmButtonText: "OK",
      });
    }
  };

  // NOTE: activating a budget deactivates every other budget for the same factory (enforced server-side).
  const handleToggleStatus = async (budget) => {
    const nextStatus = !budget.status;
    if (nextStatus) {
      const { isConfirmed } = await Swal.fire({
        title: "Activate this budget?",
        text: `This will deactivate the currently active budget for '${budget.factory?.factoryName || "this factory"}'.`,
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "Activate",
        cancelButtonText: "Cancel",
      });
      if (!isConfirmed) return;
    }

    setStatusUpdatingId(budget.id);
    try {
      await setBudgetStatus(budget.id, nextStatus);
      refetchBudgets();
    } catch (error) {
      Swal.fire({
        title: "Error!",
        text: error.message || "Failed to update budget status.",
        icon: "error",
        confirmButtonText: "OK",
      });
    } finally {
      setStatusUpdatingId(null);
    }
  };

  return (
    <div>
      {/* Add Budget Button - visible when form is hidden */}
      {!showForm && (
        <div className="mb-4">
          <Button
            variant="primary"
            onClick={() => {
              resetForm(); // Reset form to empty state
              setShowForm(true); // Show the form
            }}
          >
            + Add Budget
          </Button>
        </div>
      )}

      {/* Budget Form - visible when showForm is true */}
      {showForm && (
        <div>
          <Card
            title={editingId ? "Edit Budget" : "Add New Budget"}
            variant="navy"
          >
            <form
              className="w-full min-h-50 p-4 grid gap-y-2"
              onSubmit={handleSubmit}
            >
              <FieldSelect
                label="Factory"
                value={form.factoryId}
                onChange={(e) => handleFieldChange("factoryId", e.target.value)}
                disabled={!!editingId}
              >
                <option value="">Select Factory</option>
                {factories && factories.length > 0 ? (
                  factories.map((fac) => (
                    <option value={fac.id} key={fac.id}>
                      {fac.factoryName}
                    </option>
                  ))
                ) : (
                  <option value="" disabled>
                    No factories configured yet, please add them using "Factory
                    Master" page
                  </option>
                )}
              </FieldSelect>
              <div className="grid grid-cols-3 gap-4">
                <FieldInput
                  label="MO"
                  value={form.moCount}
                  type="number"
                  min="0"
                  onChange={(e) => handleFieldChange("moCount", e.target.value)}
                />
                <FieldInput
                  label="TMO"
                  value={form.tmoCount}
                  type="number"
                  min="0"
                  onChange={(e) =>
                    handleFieldChange("tmoCount", e.target.value)
                  }
                />
                <FieldInput
                  label="Total"
                  type="number"
                  disabled
                  value={total}
                />
              </div>

              <div className="flex gap-4 justify-end pt-4">
                {editingId && (
                  <Button
                    type="button"
                    onClick={handleCancelEdit}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                )}
                <Button type="submit" variant="primary" disabled={isSubmitting}>
                  {isSubmitting ? "Saving…" : editingId ? "Update" : "Add"}
                </Button>
                {/* Close button to hide form */}
                {!editingId && (
                  <Button
                    type="button"
                    variant="default"
                    onClick={() => {
                      resetForm();
                      setShowForm(false);
                    }}
                    disabled={isSubmitting}
                  >
                    Close
                  </Button>
                )}
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* BUDGET SUMMARY SECTION */}
      <Card
        title="Budget History"
        className="mt-8"
        actions={
          <select
            className="h-8 text-xs rounded-md px-2 bg-white text-navy-dark border border-transparent focus:outline-none"
            value={filterFactoryId}
            onChange={(e) => setFilterFactoryId(e.target.value)}
          >
            <option value="">All Factories</option>
            {factories.map((fac) => (
              <option value={fac.id} key={fac.id}>
                {fac.factoryName}
              </option>
            ))}
          </select>
        }
      >
        {loadingBudgets ? (
          <div className="p-10 text-center text-sm text-slate-400">
            Loading budgets…
          </div>
        ) : budgets.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-400">
            No budgets found. Add one above.
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-gray-500 border-b border-gray-200">
                  <th className="py-2 pr-3 pl-4 pt-6">Budget Id</th>
                  <th className="py-2 pr-3 pt-6">Factory</th>
                  <th className="py-2 pr-3 pt-6">MO Count</th>
                  <th className="py-2 pr-3 pt-6">TMO Count</th>
                  <th className="py-2 pr-3 pt-6">Total</th>
                  <th className="py-2 pr-3 pt-6">Created At</th>
                  <th className="py-2 pr-3 pt-6">Created By</th>
                  <th className="py-2 pr-3 pt-6 text-center">Active</th>
                  <th className="py-2 pr-3 pt-6 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {budgets.map((bdg) => (
                  <tr
                    key={bdg.id}
                    className="border-b border-gray-200 hover:bg-gray-50 transition-colors"
                  >
                    <td className="py-2.5 pr-3 pl-4 font-medium text-gray-800">
                      {bdg.id}
                    </td>
                    <td className="py-2.5 pr-3 pl-4 font-medium text-gray-800">
                      {bdg.factory?.factoryName || "-"}
                    </td>
                    <td className="py-2.5 pr-3 pl-4 font-medium text-gray-800">
                      {bdg.moCount}
                    </td>
                    <td className="py-2.5 pr-3 pl-4 font-medium text-gray-800">
                      {bdg.tmoCount}
                    </td>
                    <td className="py-2.5 pr-3 pl-4 font-medium text-gray-800">
                      {bdg.total}
                    </td>
                    <td className="py-2.5 pr-3 pl-4 text-gray-500 text-xs">
                      {visualizeDateTime(bdg.createdAt)}
                    </td>
                    <td className="py-2.5 pr-3 pl-4 text-gray-600">
                      {bdg.creator?.userName || "-"}
                    </td>
                    <td className="py-2.5 pr-3 pl-4 font-medium text-gray-800 text-center">
                      <input
                        type="checkbox"
                        checked={bdg.status}
                        disabled={statusUpdatingId === bdg.id}
                        onChange={() => handleToggleStatus(bdg)}
                      />
                    </td>
                    <td className="py-2.5 pr-3">
                      <div className="flex gap-2 justify-center">
                        <button
                          className="py-1.5 px-2.5 bg-blue-50 rounded-sm border border-blue-200 cursor-pointer hover:bg-blue-100 duration-200"
                          onClick={() => handleEdit(bdg)}
                          title="Edit budget"
                          type="button"
                        >
                          <CiEdit size={18} color="#2563eb" />
                        </button>
                        <button
                          className="py-1.5 px-2.5 bg-red-50 rounded-sm border border-red-200 cursor-pointer hover:bg-red-100 duration-200"
                          onClick={() => handleDelete(bdg)}
                          title="Delete budget"
                          type="button"
                        >
                          <MdDeleteForever size={18} color="#dc2626" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

export default ManageBudget;
