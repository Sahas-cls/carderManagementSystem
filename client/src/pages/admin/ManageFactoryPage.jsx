import React, { useState } from "react";
import { FieldInput } from "../../components/ui/FormField";
import { getFactories } from "../../services/factoryServices";
import { useEffect } from "react";
import useDailyCadreRecords from "../../hooks/useDailyCadreRecords";
import Card from "../../components/ui/Card";
import { CiEdit } from "react-icons/ci";
import { MdDeleteForever } from "react-icons/md";
import Button from "../../components/ui/Button";
import Swal from "sweetalert2";
import {
  createFactory,
  editFactory,
  deleteFactory,
} from "../../services/factoryServices";

const ManageFactoryPage = () => {
  const { factories, loading, refetch } = useDailyCadreRecords();
  const [notification, setNotification] = useState("");
  const [editing, setEditing] = useState(null); // Changed to null
  const [factory, setFactory] = useState({
    factoryCode: "",
    factoryName: "",
  });
  const [addFactory, setAddFactory] = useState(false); // Start with false
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const handleSubmit = async (e) => {
    e.preventDefault(); // Prevent default form submission

    // Validation
    if (!factory.factoryCode.trim()) {
      Swal.fire({
        title: "Validation Error",
        text: "Factory Code is required",
        icon: "error",
        confirmButtonText: "OK",
      });
      return;
    }

    if (!factory.factoryName.trim()) {
      Swal.fire({
        title: "Validation Error",
        text: "Factory Name is required",
        icon: "error",
        confirmButtonText: "OK",
      });
      return;
    }

    // Prevent double submission
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      let result;
      if (!editing) {
        // Create new factory
        result = await createFactory(factory);
        Swal.fire({
          title: "Success!",
          text: "Factory created successfully",
          icon: "success",
          timer: 2000,
          showConfirmButton: false,
        });
      } else {
        // Update existing factory
        result = await editFactory(editing, factory);
        Swal.fire({
          title: "Success!",
          text: "Factory updated successfully",
          icon: "success",
          timer: 2000,
          showConfirmButton: false,
        });
      }

      // Reset form
      setFactory({ factoryCode: "", factoryName: "" });
      setEditing(null);
      setAddFactory(false);
      refetch();
      setNotification("");
    } catch (error) {
      console.error("Error submitting factory:", error);
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

  const handleDelete = async (facId, factoryName) => {
    const { isConfirmed } = await Swal.fire({
      title: `Are you sure you want to delete '${factoryName}' factory?`,
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
      await deleteFactory(facId);
      Swal.fire({
        title: "Deleted!",
        text: `Factory '${factoryName}' has been deleted.`,
        icon: "success",
        timer: 2000,
        showConfirmButton: false,
      });
      refetch();
    } catch (error) {
      console.error("Error deleting factory:", error);
      Swal.fire({
        title: "Error!",
        text: error.message || "Failed to delete factory",
        icon: "error",
        confirmButtonText: "OK",
      });
    }
  };

  const handleEdit = (fac) => {
    setFactory({
      factoryCode: fac.factoryCode || "",
      factoryName: fac.factoryName || "",
    });
    setEditing(fac.id);
    setAddFactory(true);
  };

  const handleCancel = () => {
    // Check if form has unsaved changes
    if (factory.factoryCode || factory.factoryName) {
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
        }
      });
    } else {
      resetForm();
    }
  };

  const resetForm = () => {
    setFactory({ factoryCode: "", factoryName: "" });
    setEditing(null);
    setAddFactory(false);
    setIsSubmitting(false);
  };

  return (
    <div className="p-4">
      <div className="flex justify-end mb-4">
        {!addFactory && (
          <Button variant="primary" onClick={() => setAddFactory(true)}>
            Add Factory
          </Button>
        )}
      </div>

      {addFactory && (
        <div className="w-full border p-6 rounded-md border-gray-300 shadow-md relative bg-white mb-6">
          <form onSubmit={handleSubmit}>
            <div className="flex flex-wrap md:flex-nowrap gap-4">
              <div className="grow md:grow-0 md:w-1/3">
                <FieldInput
                  label="Factory Code"
                  placeholder="e.g., CAL"
                  value={factory.factoryCode}
                  onChange={(e) =>
                    setFactory((prev) => ({
                      ...prev,
                      factoryCode: e.target?.value || e.value || "",
                    }))
                  }
                />
              </div>

              <div className="grow">
                <FieldInput
                  label="Factory Name"
                  type="text"
                  required
                  placeholder="e.g., Concord Apparel (Pvt) Ltd"
                  value={factory.factoryName}
                  onChange={(e) =>
                    setFactory((prev) => ({
                      ...prev,
                      factoryName: e.target?.value || e.value || "",
                    }))
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
                  ? editing
                    ? "Updating..."
                    : "Saving..."
                  : editing
                    ? "Update"
                    : "Save"}
              </Button>
            </div>
          </form>
        </div>
      )}

      <div className="mt-4 p-4 rounded-md">
        <Card title="Manage Factories" variant="navy">
          <div className="p-4 overflow-auto">
            {loading ? (
              <div className="text-center text-sm text-slate-400 py-10">
                Loading factories...
              </div>
            ) : factories.length === 0 ? (
              <div className="text-center text-sm text-slate-400 py-10">
                No factories found. Click "Add Factory" to create one.
              </div>
            ) : (
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-gray-500 border-b border-gray-200">
                    <th className="py-2 pr-3">Factory Code</th>
                    <th className="py-2 pr-3">Factory Name</th>
                    <th className="py-2 pr-3">Created By</th>
                    <th className="py-2 pr-3">Created At</th>
                    <th className="py-2 pr-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {factories.map((fac) => (
                    <tr
                      key={fac.id}
                      className="border-b border-gray-200 hover:bg-gray-50 transition-colors"
                    >
                      <td className="py-2.5 pr-3 font-medium text-gray-800">
                        {fac?.factoryCode || "N/A"}
                      </td>
                      <td className="py-2.5 pr-3 text-gray-600">
                        {fac?.factoryName || "N/A"}
                      </td>
                      <td className="py-2.5 pr-3 text-gray-600">
                        {fac?.creator?.userName || "-"}
                      </td>
                      <td className="py-2.5 pr-3 text-gray-500 text-xs">
                        {visualizeDateTime(fac?.createdAt)}
                      </td>
                      <td className="py-2.5 pr-3">
                        <div className="flex gap-2 justify-center">
                          <button
                            className="py-1.5 px-2.5 bg-blue-50 rounded-sm border border-blue-200 cursor-pointer hover:bg-blue-100 duration-200"
                            onClick={() => handleEdit(fac)}
                            title="Edit factory"
                          >
                            <CiEdit size={18} color="#2563eb" />
                          </button>
                          <button
                            className="py-1.5 px-2.5 bg-red-50 rounded-sm border border-red-200 cursor-pointer hover:bg-red-100 duration-200"
                            onClick={() =>
                              handleDelete(fac.id, fac?.factoryName)
                            }
                            title="Delete factory"
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

      {notification && (
        <div className="fixed bottom-4 right-4 bg-green-500 text-white px-6 py-3 rounded-md shadow-lg">
          {notification}
        </div>
      )}
    </div>
  );
};

export default ManageFactoryPage;
