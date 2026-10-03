// git new 5:26pm

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import { FieldSelect } from "../../components/ui/FormField";
import Notice from "../../components/ui/Notice";
import useNotice from "../../hooks/useNotice";
import useWeeklyCadre from "../../hooks/useWeeklyCadre";
import {
  exportWeeklyExcel,
  exportWeeklyStatusReport,
} from "../../utils/excelExport";
import { getWeeklyStatusReport } from "../../services/cadreServices";
import WeeklyGroupTable from "./components/WeeklyGroupTable";
import ReportDateRangeModal from "./components/ReportDateRangeModal";

/**
 * Read-only: Weekly View has no data of its own, it's a live aggregate of
 * Daily Data Entry (each week+factory's numbers are the sum of every daily
 * submission for that week). Add or correct numbers via Daily Data Entry.
 */
export default function WeeklyViewPage() {
  const navigate = useNavigate();
  const [factoryId, setFactoryId] = useState("");
  const [weekId, setWeekId] = useState("");
  const [notice, showNotice] = useNotice();
  const [showReportModal, setShowReportModal] = useState(false);

  const { rows, factories, weeks, loading, error } = useWeeklyCadre({
    factoryId: factoryId || undefined,
    weekId: weekId || undefined,
  });

  const groups = useMemo(() => {
    const map = new Map();
    rows.forEach((r) => {
      const key = `${r.weekId ?? "no-week"}||${r.factoryId ?? "no-factory"}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(r);
    });
    return [...map.entries()].sort(([, a], [, b]) => {
      const [rowA] = a;
      const [rowB] = b;
      return (
        (rowA.date || "").localeCompare(rowB.date || "") ||
        rowA.factory.localeCompare(rowB.factory)
      );
    });
  }, [rows]);

  const handleClear = () => {
    setFactoryId("");
    setWeekId("");
  };

  const handleDownload = async () => {
    if (!rows.length) {
      showNotice("No matching weekly records to download.", "err");
      return;
    }
    try {
      await exportWeeklyExcel(rows);
      showNotice("Weekly Excel downloaded successfully.", "ok");
    } catch (err) {
      showNotice(err.message || "Failed to generate the Excel file.", "err");
    }
  };

  // "Download Excel 2" - the factory-wise Weekly Cadre Status Report for a
  // chosen date range (asked for in ReportDateRangeModal). Follows the
  // Factory filter above; the Week filter doesn't apply, the range replaces it.
  const handleDownloadReport = async ({ from, to }) => {
    try {
      const reportRows = await getWeeklyStatusReport({
        from,
        to,
        factoryId: factoryId || undefined,
      });
      if (!reportRows.length) {
        showNotice("No daily entries found in the selected date range.", "err");
        return;
      }
      await exportWeeklyStatusReport(reportRows, { from, to });
      setShowReportModal(false);
      showNotice("Weekly Cadre Status Report downloaded successfully.", "ok");
    } catch (err) {
      showNotice(err.message || "Failed to generate the report.", "err");
    }
  };

  return (
    <div>
      <Notice message={notice?.message} type={notice?.type} />
      <ReportDateRangeModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        onConfirm={handleDownloadReport}
        factoryLabel={
          factoryId
            ? factories.find((f) => String(f.id) === String(factoryId))
                ?.factoryName || "Selected factory"
            : "All factories"
        }
      />
      {error && (
        <Notice message={`Failed to load weekly data: ${error}`} type="err" />
      )}

      <Card title="Weekly Data View" variant="orange">
        <div className="p-4 grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3 items-end">
          <FieldSelect
            label="Factory"
            value={factoryId}
            onChange={(e) => setFactoryId(e.target.value)}
          >
            <option value="">All Factories</option>
            {factories.map((f) => (
              <option key={f.id} value={f.id}>
                {f.factoryName}
              </option>
            ))}
          </FieldSelect>

          <FieldSelect
            label="Week"
            value={weekId}
            onChange={(e) => setWeekId(e.target.value)}
          >
            <option value="">All Weeks</option>
            {weeks.map((w) => (
              <option key={w.id} value={w.id}>
                {w.week}
              </option>
            ))}
          </FieldSelect>
          <div className="flex gap-2">
            <Button onClick={handleClear}>Clear</Button>
            <Button variant="orange" onClick={handleDownload}>
              Download Excel
            </Button>

            <Button variant="orange" onClick={() => setShowReportModal(true)}>
              Download Excel 2
            </Button>
          </div>
        </div>
      </Card>

      {loading ? (
        <Card>
          <div className="p-10 text-center text-sm text-slate-400">
            Loading weekly records…
          </div>
        </Card>
      ) : groups.length === 0 ? (
        <Card>
          <div className="p-10 text-center text-sm text-slate-400 flex flex-col items-center gap-3">
            <span>
              No weekly records available for the selected factory/week.
            </span>
            <Button
              variant="teal"
              small
              onClick={() => navigate("/daily-entry")}
            >
              Go to Daily Data Entry
            </Button>
          </div>
        </Card>
      ) : (
        groups.map(([key, groupRows]) => {
          const [{ week: weekLabel, factory: factoryLabel }] = groupRows;
          return (
            <WeeklyGroupTable
              key={key}
              week={weekLabel}
              factory={factoryLabel}
              rows={groupRows}
            />
          );
        })
      )}
    </div>
  );
}
