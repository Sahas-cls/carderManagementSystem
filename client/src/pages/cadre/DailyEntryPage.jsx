import { useMemo, useState } from "react";
import Button from "../../components/ui/Button";
import Notice from "../../components/ui/Notice";
import useCadreRecords from "../../hooks/useCadreRecords";
import useNotice from "../../hooks/useNotice";
import { EMPTY_CADRE_FORM, buildRecord, computeTotals, matchWeekForDate, recordToForm } from "../../utils/cadreCalculations";
import { exportDailyExcel } from "../../utils/excelExport";
import CadreDetailsCard from "./components/CadreDetailsCard";
import DailyRecordsTable from "./components/DailyRecordsTable";
import RecordInfoCard from "./components/RecordInfoCard";

export default function DailyEntryPage() {
  const { records, addRecord, updateRecord, deleteRecord } = useCadreRecords();
  const [form, setForm] = useState(EMPTY_CADRE_FORM);
  const [editingIndex, setEditingIndex] = useState(-1);
  const [notice, showNotice] = useNotice();

  const totals = useMemo(() => computeTotals(form), [form]);
  const isEditing = editingIndex >= 0;

  const handleChange = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      // Picking a date auto-fills the matching Week No., same as the original tool.
      if (field === "date" && value) {
        const matchedWeek = matchWeekForDate(value);
        if (matchedWeek) next.week = matchedWeek;
      }
      return next;
    });
  };

  const resetForm = () => {
    setForm(EMPTY_CADRE_FORM);
    setEditingIndex(-1);
  };

  const handleAdd = () => {
    if (!form.factory) {
      showNotice("Please select a factory first.", "err");
      return;
    }
    if (!form.date && !form.week) {
      showNotice("Please enter a Date or select a Week No.", "err");
      return;
    }

    const record = buildRecord(form, totals);
    if (isEditing) {
      updateRecord(editingIndex, record);
      showNotice("Record updated successfully.", "ok");
    } else {
      addRecord(record);
      showNotice("Record added successfully.", "ok");
    }
    resetForm();
  };

  const handleClear = () => {
    resetForm();
    showNotice("Entry fields cleared.", "ok");
  };

  const handleEdit = (index) => {
    setForm(recordToForm(records[index]));
    setEditingIndex(index);
    showNotice("Record loaded. Make your changes and click Update Record.", "ok");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = (index) => {
    if (!window.confirm("Delete this record?")) return;
    deleteRecord(index);
    if (editingIndex === index) resetForm();
    showNotice("Record deleted.", "ok");
  };

  const handleDownload = () => {
    if (!records.length) {
      showNotice("There are no records to download.", "err");
      return;
    }
    exportDailyExcel(records);
    showNotice("Daily Excel downloaded successfully.", "ok");
  };

  return (
    <div>
      <Notice message={notice?.message} type={notice?.type} />

      <RecordInfoCard form={form} onChange={handleChange} />
      <CadreDetailsCard form={form} totals={totals} onChange={handleChange} />

      {isEditing && (
        <div className="mb-4 px-3.5 py-2.5 bg-orange-soft border border-orange-200 rounded-md text-[#89511d] text-xs">
          Editing an existing record — update the fields and click <b>Update Record</b>.
        </div>
      )}

      <div className="flex justify-end gap-2.5 mb-5">
        <Button onClick={handleClear}>Clear</Button>
        <Button variant="primary" onClick={handleAdd}>
          {isEditing ? "Update Record" : "Add to Table"}
        </Button>
        <Button variant="teal" onClick={handleDownload}>
          Download Excel
        </Button>
      </div>

      <DailyRecordsTable records={records} onEdit={handleEdit} onDelete={handleDelete} />
    </div>
  );
}
