import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import StatCard from "../../components/ui/StatCard";
import { Badge } from "../../components/ui/Badge";
import useCadreRecords from "../../hooks/useCadreRecords";

export default function DashboardPage() {
  const { records } = useCadreRecords();
  const navigate = useNavigate();

  const weeks = useMemo(
    () => [...new Set(records.map((r) => r.week).filter(Boolean))],
    [records],
  );
  const latest = records.length ? records[records.length - 1] : null;

  const recentWeeks = useMemo(
    () =>
      weeks
        .slice(-5)
        .reverse()
        .map((week) => ({
          week,
          count: records.filter((r) => r.week === week).length,
        })),
    [weeks, records],
  );

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <StatCard label="Daily Records" value={records.length} accent={0} />
        <StatCard label="Weeks Covered" value={weeks.length} accent={1} />
        <StatCard
          label="Current MO"
          value={latest ? latest.cmo : 0}
          accent={2}
        />
        <StatCard
          label="Current TMO"
          value={latest ? latest.ctmo : 0}
          accent={3}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-5">
        <Card title="System Overview" variant="teal">
          <div className="p-4">
            <p className="text-[13px] leading-relaxed text-slate-600 mt-0">
              Use <b>Daily Data Entry</b> to enter cadre records. The weekly
              view is automatically updated from the saved daily records and can
              be downloaded as Excel.
            </p>
            <div className="flex gap-2.5 pt-3">
              <Button variant="teal" onClick={() => navigate("/daily-entry")}>
                Go to Daily Data Entry
              </Button>
              <Button variant="orange" onClick={() => navigate("/weekly-view")}>
                View Weekly Data
              </Button>
            </div>
          </div>
        </Card>

        <Card title="Recent Weekly Records" variant="orange">
          <div className="px-4 pb-3.5">
            {recentWeeks.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-400">
                No records yet.
              </div>
            ) : (
              recentWeeks.map(({ week, count }) => (
                <div
                  key={week}
                  className="flex justify-between items-center py-3 border-b border-slate-100 text-xs last:border-0"
                >
                  <span>{week}</span>
                  <Badge>
                    {count} daily record{count === 1 ? "" : "s"}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
