import { useEffect, useMemo, useState } from "react";
import Button from "../../components/ui/Button";
import Notice from "../../components/ui/Notice";
import useActiveBudget from "../../hooks/useActiveBudget";
import useAuth from "../../hooks/useAuth";
import useDailyCadreRecords from "../../hooks/useDailyCadreRecords";
import useNotice from "../../hooks/useNotice";
import { getPreviousDailyRecord } from "../../services/dailyCadreServices";
import {
  EMPTY_CADRE_FORM,
  buildPayload,
  computeTotals,
  recordToForm,
  todayDateStr,
} from "../../utils/cadreCalculations";
import { exportDailyExcel } from "../../utils/excelExport";
import CadreDetailsCard from "./components/CadreDetailsCard";
import DailyRecordsTable from "./components/DailyRecordsTable";
import RecordInfoCard from "./components/RecordInfoCard";

export default function DailyEntryPage() {
  const { user } = useAuth();
  // The logged-in user's assigned factory (Manage Users, admin-set) pre-fills
  // the form and scopes the records table below - users with no factory
  // assigned fall back to the old "pick one" behaviour, unfiltered.
  const userFactoryId = user?.factory?.id ? String(user.factory.id) : "";
  const emptyForm = useMemo(
    () => ({ ...EMPTY_CADRE_FORM, factoryId: userFactoryId, date: todayDateStr() }),
    [userFactoryId],
  );

  const {
    records,
    factories,
    weeks,
    loading,
    error,
    addRecord,
    updateRecord,
    deleteRecord,
  } = useDailyCadreRecords(userFactoryId);
  const [form, setForm] = useState(emptyForm);
  const [editingRecord, setEditingRecord] = useState(null);
  const [saving, setSaving] = useState(false);
  const [notice, showNotice] = useNotice();

  // Planned MO/TMO is no longer typed in by hand - it always mirrors whichever budget is
  // currently active (Budget Master) for the selected factory, so it's derived here rather
  // than stored as an editable form field.
  const { activeBudget, loading: loadingActiveBudget } = useActiveBudget(
    form.factoryId,
  );
  const plannedForm = useMemo(
    () => ({
      ...form,
      plannedMO: activeBudget?.moCount ?? 0,
      plannedTMO: activeBudget?.tmoCount ?? 0,
    }),
    [form, activeBudget],
  );
  const plannedHint =
    form.factoryId && !loadingActiveBudget && !activeBudget
      ? "No active budget set for this factory in Budget Master."
      : "";

  const totals = useMemo(() => computeTotals(plannedForm), [plannedForm]);
  const isEditing = !!editingRecord;

  // Carries values forward from the factory's most recent earlier entry into
  // a fresh Daily Data Entry form: Allocated_Actual MO/TMO default to that
  // entry's Allocated_Current MO/TMO, and Training Center's Allocated
  // defaults to that entry's Actual Allocated (itself now derived - see
  // CadreDetailsCard's "Actual Allocated" field). Only fills fields still at
  // their untouched default, so it never clobbers something the user already
  // typed, and never runs while editing a saved record (that already has its
  // own real values via recordToForm).
  useEffect(() => {
    if (isEditing || !form.factoryId || !form.date) return;
    let cancelled = false;
    getPreviousDailyRecord({ factoryId: form.factoryId, date: form.date })
      .then((prev) => {
        if (cancelled || !prev) return;
        setForm((f) => {
          if (f.allocActualMO !== "" && f.allocActualTMO !== "" && f.tcAllocated) return f;
          return {
            ...f,
            allocActualMO: f.allocActualMO === "" ? String(prev.currentMO ?? 0) : f.allocActualMO,
            allocActualTMO: f.allocActualTMO === "" ? String(prev.currentTMO ?? 0) : f.allocActualTMO,
            tcAllocated: f.tcAllocated ? f.tcAllocated : prev.tcActual ?? 0,
          };
        });
      })
      .catch(() => {
        // Prefill is a convenience, not required - a failed lookup just
        // leaves the fields at their normal blank/zero defaults.
      });
    return () => {
      cancelled = true;
    };
  }, [form.factoryId, form.date, isEditing]);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingRecord(null);
  };

  const handleAdd = async () => {
    if (!form.factoryId) {
      showNotice("Please select a factory first.", "err");
      return;
    }
    if (!form.date) {
      showNotice("Please enter a Date.", "err");
      return;
    }

    const resignedTotal = (Number(form.resignedMO) || 0) + (Number(form.resignedTMO) || 0);
    const resignedEmployees = form.resignedEmployees || [];
    const REQUIRED_EMPLOYEE_FIELDS = [
      "epf",
      "employeeName",
      "designationId",
      "departmentId",
      "sectionId",
      "dateOfJoin",
      "dateOfResign",
      "resignationReasonId",
    ];
    if (resignedTotal > 0 && resignedEmployees.length !== resignedTotal) {
      showNotice(
        `Please enter details for all ${resignedTotal} resigned employee(s) (see the Resigned/Terminated popup) before submitting.`,
        "err",
      );
      return;
    }
    if (
      resignedEmployees.some((emp) => REQUIRED_EMPLOYEE_FIELDS.some((field) => !emp[field]))
    ) {
      showNotice(
        "One or more resigned employee rows are missing details - please complete them before submitting.",
        "err",
      );
      return;
    }

    const payload = buildPayload(plannedForm);
    setSaving(true);
    try {
      if (isEditing) {
        await updateRecord(editingRecord.batchId, payload);
        showNotice("Record updated successfully.", "ok");
      } else {
        await addRecord(payload);
        showNotice("Record added successfully.", "ok");
      }
      resetForm();
    } catch (err) {
      showNotice(err.message || "Failed to save the record.", "err");
    } finally {
      setSaving(false);
    }
  };

  const handleClear = () => {
    resetForm();
    showNotice("Entry fields cleared.", "ok");
  };

  const handleEdit = (record) => {
    setForm(recordToForm(record));
    setEditingRecord(record);
    showNotice(
      "Record loaded. Make your changes and click Update Record.",
      "ok",
    );
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (record) => {
    if (!window.confirm("Delete this record?")) return;
    try {
      await deleteRecord(record.batchId);
      if (editingRecord?.batchId === record.batchId) resetForm();
      showNotice("Record deleted.", "ok");
    } catch (err) {
      showNotice(err.message || "Failed to delete the record.", "err");
    }
  };

  const handleDownload = async () => {
    if (!records.length) {
      showNotice("There are no records to download.", "err");
      return;
    }
    try {
      await exportDailyExcel(records);
      showNotice("Daily Excel downloaded successfully.", "ok");
    } catch (err) {
      showNotice(err.message || "Failed to generate the Excel file.", "err");
    }
  };

  return (
    <div>
      <Notice message={notice?.message} type={notice?.type} />
      {error && (
        <Notice message={`Failed to load records: ${error}`} type="err" />
      )}

      <RecordInfoCard
        form={form}
        onChange={handleChange}
        factories={factories}
        weeks={weeks}
      />
      <CadreDetailsCard
        form={plannedForm}
        totals={totals}
        onChange={handleChange}
        plannedHint={plannedHint}
      />

      {isEditing && (
        <div className="mb-4 px-3.5 py-2.5 bg-orange-soft border border-orange-200 rounded-md text-[#89511d] text-xs">
          Editing an existing record — update the fields and click{" "}
          <b>Update Record</b>.
        </div>
      )}

      <div className="flex justify-end gap-2.5 mb-5">
        <Button onClick={handleClear} disabled={saving}>
          Clear
        </Button>
        <Button variant="primary" onClick={handleAdd} disabled={saving}>
          {saving ? "Saving…" : isEditing ? "Update Record" : "Add to Table"}
        </Button>
        <Button variant="teal" onClick={handleDownload}>
          Download Excel
        </Button>
      </div>

      {loading ? (
        <div className="p-10 text-center text-sm text-slate-400">
          Loading this month's records…
        </div>
      ) : (
        <DailyRecordsTable
          records={records}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
