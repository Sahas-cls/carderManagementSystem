import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import StatCard from "../../components/ui/StatCard";
import { Badge } from "../../components/ui/Badge";
import useAuth from "../../hooks/useAuth";
import useDailyCadreRecords from "../../hooks/useDailyCadreRecords";
import TrendAreaChart from "../../components/charts/TrendAreaChart";
import BarChart from "../../components/charts/BarChart";
import DonutChart from "../../components/charts/DonutChart";
import { CHART_COLORS } from "../../components/charts/chartTheme";

export default function DashboardPage() {
  const { records } = useDailyCadreRecords();
  const { user } = useAuth();
  const navigate = useNavigate();

  // The logged-in user's assigned factory (same convention as Daily Data
  // Entry) - users with no factory assigned (e.g. an unassigned Administrator)
  // simply see an empty state on the factory-specific chart below.
  const userFactoryId = user?.factory?.id ?? null;
  const userFactoryName = user?.factory?.factoryName || "your factory";

  const weeks = useMemo(
    () => [...new Set(records.map((r) => r.week).filter(Boolean))],
    [records],
  );
  // Records come back newest-entered first (see useDailyCadreRecords).
  const latest = records.length ? records[0] : null;

  // `weeks` already follows `records`' newest-first order, so the first 5
  // distinct weeks are the 5 most recently touched ones.
  const recentWeeks = useMemo(
    () =>
      weeks.slice(0, 5).map((week) => ({
        week,
        count: records.filter((r) => r.week === week).length,
      })),
    [weeks, records],
  );

  // Organization-wide planned vs current headcount, summed across factories
  // for each date this month and sorted oldest -> newest for the trend line.
  const trendData = useMemo(() => {
    const byDate = new Map();
    records.forEach((r) => {
      if (!r.date) return;
      const entry = byDate.get(r.date) || {
        date: r.date,
        planned: 0,
        current: 0,
      };
      entry.planned += Number(r.pt) || 0;
      entry.current += Number(r.ct) || 0;
      byDate.set(r.date, entry);
    });
    return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [records]);

  // Most recent daily record per factory (records arrive newest-entered
  // first, so the first hit per factoryId is its latest snapshot).
  const latestByFactory = useMemo(() => {
    const map = new Map();
    records.forEach((r) => {
      if (r.factoryId == null || map.has(r.factoryId)) return;
      map.set(r.factoryId, r);
    });
    return [...map.values()].sort((a, b) =>
      (a.factory || "").localeCompare(b.factory || ""),
    );
  }, [records]);

  const attendanceData = useMemo(
    () =>
      latestByFactory.map((r) => ({
        label: r.factory,
        values: { present: Number(r.prt) || 0, absent: Number(r.abt) || 0 },
      })),
    [latestByFactory],
  );

  const shortageData = useMemo(
    () =>
      latestByFactory.map((r) => ({
        label: r.factory,
        values: { shortage: Math.max(0, Number(r.st) || 0) },
      })),
    [latestByFactory],
  );

  const compositionData = useMemo(() => {
    const totals = latestByFactory.reduce(
      (acc, r) => {
        acc.mo += Number(r.cmo) || 0;
        acc.tmo += Number(r.ctmo) || 0;
        return acc;
      },
      { mo: 0, tmo: 0 },
    );
    return [
      { label: "Current MO", value: totals.mo, color: CHART_COLORS.blue },
      { label: "Current TMO", value: totals.tmo, color: CHART_COLORS.aqua },
    ];
  }, [latestByFactory]);

  // This month's records for the logged-in user's own factory only.
  const myFactoryRecords = useMemo(
    () =>
      userFactoryId ? records.filter((r) => r.factoryId === userFactoryId) : [],
    [records, userFactoryId],
  );

  // Present MO/TMO for that factory, summed per week (weekId groups the
  // records; each group's earliest date orders the weeks oldest -> newest).
  const weeklyPresentData = useMemo(() => {
    const byWeek = new Map();
    myFactoryRecords.forEach((r) => {
      const key = r.weekId ?? r.week;
      if (key == null) return;
      const entry = byWeek.get(key) || {
        label: r.week || "-",
        minDate: r.date,
        values: { mo: 0, tmo: 0 },
      };
      entry.values.mo += Number(r.prmo) || 0;
      entry.values.tmo += Number(r.prtmo) || 0;
      if (r.date && (!entry.minDate || r.date < entry.minDate))
        entry.minDate = r.date;
      byWeek.set(key, entry);
    });
    return [...byWeek.values()].sort((a, b) =>
      (a.minDate || "").localeCompare(b.minDate || ""),
    );
  }, [myFactoryRecords]);

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
        {/* <Card title="System Overview" variant="teal">
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
        </Card> */}

        {/* <Card title="Recent Weekly Records" variant="orange">
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
        </Card> */}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card title="Workforce Trend This Month" variant="navy">
          <div className="p-4 pt-3">
            <TrendAreaChart data={trendData} />
          </div>
        </Card>

        <Card title="Attendance by Factory (Latest)" variant="green">
          <div className="p-4 pt-3">
            <BarChart
              data={attendanceData}
              series={[
                { key: "present", label: "Present", color: CHART_COLORS.aqua },
                { key: "absent", label: "Absent", color: CHART_COLORS.red },
              ]}
            />
          </div>
        </Card>

        <Card title="Shortage by Factory (Latest)" variant="orange">
          <div className="p-4 pt-3">
            <BarChart
              data={shortageData}
              series={[
                { key: "shortage", label: "Shortage", color: CHART_COLORS.red },
              ]}
            />
          </div>
        </Card>

        <Card title="Current MO / TMO Composition" variant="purple">
          <div className="p-4 pt-3">
            <DonutChart data={compositionData} centerLabel="Current Total" />
          </div>
        </Card>

        <Card
          title={`Weekly Present MO/TMO — ${userFactoryName}`}
          variant="teal"
        >
          <div className="p-4 pt-3">
            {userFactoryId ? (
              <BarChart
                data={weeklyPresentData}
                series={[
                  { key: "mo", label: "Present MO", color: CHART_COLORS.blue },
                  {
                    key: "tmo",
                    label: "Present TMO",
                    color: CHART_COLORS.aqua,
                  },
                ]}
              />
            ) : (
              <div className="py-14 text-center text-sm text-slate-400">
                No factory is assigned to your account. Contact an administrator
                to assign one.
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
