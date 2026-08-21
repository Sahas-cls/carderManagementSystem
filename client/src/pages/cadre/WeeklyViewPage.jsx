import { useMemo, useState } from "react";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import { FieldSelect } from "../../components/ui/FormField";
import Notice from "../../components/ui/Notice";
import { FACTORIES, WEEKS } from "../../constants/cadre";
import useCadreRecords from "../../hooks/useCadreRecords";
import useNotice from "../../hooks/useNotice";
import { exportWeeklyExcel } from "../../utils/excelExport";
import WeeklyGroupTable from "./components/WeeklyGroupTable";

export default function WeeklyViewPage() {
  const { records } = useCadreRecords();
  const [factory, setFactory] = useState("");
  const [week, setWeek] = useState("");
  const [notice, showNotice] = useNotice();

  const filtered = useMemo(
    () => records.filter((r) => (!week || r.week === week) && (!factory || r.factory === factory)),
    [records, week, factory]
  );

  const groups = useMemo(() => {
    const map = new Map();
    filtered.forEach((r) => {
      const key = `${r.week || "No Week"}||${r.factory || "No Factory"}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(r);
    });
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const handleClear = () => {
    setFactory("");
    setWeek("");
  };

  const handleDownload = () => {
    if (!records.length) {
      showNotice("There are no records to download.", "err");
      return;
    }
    if (!filtered.length) {
      showNotice("No matching weekly records to download.", "err");
      return;
    }
    exportWeeklyExcel(filtered);
    showNotice("Weekly Excel downloaded successfully.", "ok");
  };

  return (
    <div>
      <Notice message={notice?.message} type={notice?.type} />

      <Card title="Weekly Data View" variant="orange">
        <div className="p-4 grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3 items-end">
          <FieldSelect label="Factory" value={factory} onChange={(e) => setFactory(e.target.value)}>
            <option value="">All Factories</option>
            {FACTORIES.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </FieldSelect>

          <FieldSelect label="Week No." value={week} onChange={(e) => setWeek(e.target.value)}>
            <option value="">All Weeks</option>
            {WEEKS.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </FieldSelect>

          <div className="flex gap-2">
            <Button onClick={handleClear}>Clear</Button>
            <Button variant="orange" onClick={handleDownload}>
              Download Excel
            </Button>
          </div>
        </div>
      </Card>

      {groups.length === 0 ? (
        <Card>
          <div className="p-10 text-center text-sm text-slate-400">
            No weekly records available for the selected factory/week.
          </div>
        </Card>
      ) : (
        groups.map(([key, rows]) => {
          const [weekLabel, factoryLabel] = key.split("||");
          return <WeeklyGroupTable key={key} week={weekLabel} factory={factoryLabel} rows={rows} />;
        })
      )}
    </div>
  );
}
