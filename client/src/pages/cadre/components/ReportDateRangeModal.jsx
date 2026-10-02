import { useEffect, useState } from "react";
import Button from "../../../components/ui/Button";
import { FieldInput } from "../../../components/ui/FormField";

/** Local "YYYY-MM-DD" (not toISOString, which shifts to UTC). */
function toDateOnly(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Default range: the 1st of the month two months back through today - a quarter, like the source report. */
function defaultRange() {
  const today = new Date();
  const from = new Date(today.getFullYear(), today.getMonth() - 2, 1);
  return { from: toDateOnly(from), to: toDateOnly(today) };
}

/**
 * Small popup asking for a From/To date range before generating Weekly Data
 * View's "Weekly Cadre Status Report" (Download Excel 2). `onConfirm` gets
 * { from, to } and may be async - the popup shows a generating state until
 * it settles, and the caller closes it.
 */
export default function ReportDateRangeModal({ isOpen, onClose, onConfirm, factoryLabel }) {
  const [range, setRange] = useState(defaultRange);
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setError("");
      setGenerating(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    if (!range.from || !range.to) {
      setError("Please select both a From and a To date.");
      return;
    }
    if (range.from > range.to) {
      setError("The From date cannot be after the To date.");
      return;
    }
    setGenerating(true);
    try {
      await onConfirm(range);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={generating ? undefined : onClose}
      />

      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
        <h2 className="text-lg font-semibold text-gray-800">
          Weekly Cadre Status Report
        </h2>
        <p className="text-xs text-gray-500 mt-1 mb-4">
          {factoryLabel} - each week's figures come from that factory's first
          daily entry of the week.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <FieldInput
            label="From"
            type="date"
            value={range.from}
            max={range.to || undefined}
            onChange={(e) => {
              setRange((prev) => ({ ...prev, from: e.target.value }));
              setError("");
            }}
          />
          <FieldInput
            label="To"
            type="date"
            value={range.to}
            min={range.from || undefined}
            onChange={(e) => {
              setRange((prev) => ({ ...prev, to: e.target.value }));
              setError("");
            }}
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-md text-sm mt-4">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3 mt-6">
          <Button onClick={onClose} disabled={generating}>
            Cancel
          </Button>
          <Button variant="orange" onClick={handleConfirm} disabled={generating}>
            {generating ? "Generating..." : "Download"}
          </Button>
        </div>
      </div>
    </div>
  );
}
