import { useMemo, useState } from "react";
import Card from "../../components/ui/Card";
import StatCard from "../../components/ui/StatCard";
import useAuth from "../../hooks/useAuth";
import useDailyCadreRecords from "../../hooks/useDailyCadreRecords";
import useCadreTrend from "../../hooks/useCadreTrend";
import useServiceLengthAnalysis from "../../hooks/useServiceLengthAnalysis";
import useReasonAnalysis from "../../hooks/useReasonAnalysis";
import TrendAreaChart from "../../components/charts/TrendAreaChart";
import BarChart from "../../components/charts/BarChart";
import DonutChart from "../../components/charts/DonutChart";
import {
  CATEGORICAL_COLORS,
  CHART_COLORS,
  OTHER_COLOR,
  formatMonthLabel,
} from "../../components/charts/chartTheme";

const CURRENT_YEAR = new Date().getFullYear();
// At least the past 5 years, per the Administrator's "historical insight" requirement.
const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);

/** Small uppercase section label + scope/year context, sitting above a group of cards. */
function SectionHeading({ title, context }) {
  return (
    <div className="flex items-baseline justify-between flex-wrap gap-1 mt-2 mb-3">
      <h2 className="text-[13px] font-bold text-app-text uppercase tracking-wide">
        {title}
      </h2>
      {context && <span className="text-xs text-app-muted">{context}</span>}
    </div>
  );
}

export default function DashboardPage() {
  const { records, factories } = useDailyCadreRecords();
  const { user } = useAuth();
  const isAdmin = user?.role?.userRole === "Administrator";

  // The logged-in user's assigned factory (same convention as Daily Data
  // Entry) - users with no factory assigned (e.g. an unassigned Administrator)
  // simply see an empty state on the factory-specific charts below.
  const userFactoryId = user?.factory?.id ?? null;
  const userFactoryName = user?.factory?.factoryName || "your factory";

  // Filters: every user gets a Year selector (at least the past 5 years);
  // only an Administrator gets a Factory selector too - a general user's
  // view always stays scoped to their own assigned factory. `null` for
  // selectedFactoryId means "All Factories" (Administrator only - a general
  // user is never shown that option).
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);
  const [selectedFactoryId, setSelectedFactoryId] = useState(null);
  const effectiveFactoryId = isAdmin ? selectedFactoryId : userFactoryId;
  // Whether the factory-scoped cards (Fulfilment, Composition, Attrition
  // Analysis) have something meaningful to show - an Administrator always
  // does (even "All Factories" is a valid scope), a general user only once
  // they have a factory assigned.
  const canShowScoped = isAdmin || !!userFactoryId;
  const scopeLabel = isAdmin
    ? selectedFactoryId
      ? factories.find((f) => String(f.id) === String(selectedFactoryId))
          ?.factoryName || "Selected Factory"
      : "All Factories"
    : userFactoryName;

  // This year's (calendar) remaining months haven't happened yet - averaging
  // or summing them in as zeros would misleadingly drag down every YTD-style
  // figure below. Past years use the full 12 months.
  const relevantMonthCount =
    selectedYear === CURRENT_YEAR ? new Date().getMonth() + 1 : 12;

  // This year's resigned employees for the selected scope, bucketed by
  // length of service at resignation - mirrors the "LTO_Analysis_ Service"
  // sheet in the HR Performance Analysis report. Fetched regardless of
  // whether a factory is assigned (see useServiceLengthAnalysis) - the render
  // below gates on canShowScoped.
  const { analysis: serviceLengthAnalysis } = useServiceLengthAnalysis({
    factoryId: effectiveFactoryId,
    year: selectedYear,
  });
  const serviceLengthData = useMemo(
    () =>
      (serviceLengthAnalysis?.buckets || []).map((b, i) => ({
        label: b.label,
        value: b.count,
        color: CATEGORICAL_COLORS[i % CATEGORICAL_COLORS.length],
      })),
    [serviceLengthAnalysis],
  );

  // Same year/scope, grouped by resignation reason - mirrors the
  // "LTO_ Analysis_Reason" sheet. Only the top few reasons are named (see
  // employeeService.getReasonAnalysis); "Other" gets a dedicated neutral
  // color rather than the next categorical hue, since it isn't a stable
  // category on its own.
  const { analysis: reasonAnalysis } = useReasonAnalysis({
    factoryId: effectiveFactoryId,
    year: selectedYear,
  });
  const reasonData = useMemo(
    () =>
      (reasonAnalysis?.reasons || []).map((r, i) => ({
        label: r.label,
        value: r.count,
        color:
          r.label === "Other"
            ? OTHER_COLOR
            : CATEGORICAL_COLORS[i % CATEGORICAL_COLORS.length],
      })),
    [reasonAnalysis],
  );

  // Group-wide (or single-factory, once selected) Budget vs Allocated,
  // Recruitment vs Resign, one point per month across the selected year -
  // mirrors the "Cadre Trend" / "Recruitment & Resign" sheets in the HR
  // Performance Analysis report. See dailyCadreService.getCadreTrend for how
  // each month's figures are resolved.
  const { trend } = useCadreTrend({
    year: selectedYear,
    factoryId: effectiveFactoryId || undefined,
  });
  const trendMonths = useMemo(
    () => (trend?.group || []).slice(0, relevantMonthCount),
    [trend, relevantMonthCount],
  );

  const cadreTrendData = useMemo(
    () =>
      trendMonths.map((m) => ({
        date: m.month,
        budget: m.budget,
        allocated: m.allocated,
      })),
    [trendMonths],
  );
  const recruitResignData = useMemo(
    () =>
      trendMonths.map((m) => ({
        date: m.month,
        recruitment: m.recruitment,
        resigned: m.resigned,
      })),
    [trendMonths],
  );
  // LTO (Labour Turnover) ratio - mirrors the "LTO_Auto" sheet, computed as
  // Resign / Allocated for the month (already in trendMonths above, so this
  // is purely derived - no extra request). A month with no allocated
  // headcount yet reports 0 rather than the sheet's #DIV/0!.
  const ltoData = useMemo(
    () =>
      trendMonths.map((m) => ({
        date: m.month,
        lto: m.allocated
          ? Math.round((m.resigned / m.allocated) * 1000) / 10
          : 0,
      })),
    [trendMonths],
  );
  // Absenteeism rate - mirrors the "Absenteeism" sheet, same derivation as LTO Ratio above.
  const absenteeismData = useMemo(
    () =>
      trendMonths.map((m) => ({
        date: m.month,
        absenteeism: m.allocated
          ? Math.round((m.absent / m.allocated) * 1000) / 10
          : 0,
      })),
    [trendMonths],
  );

  // Headline KPI tiles for the selected year/scope - recruited/resigned are
  // summed, the two rates are averaged across the same realized months.
  const kpis = useMemo(() => {
    const recruited = trendMonths.reduce((sum, m) => sum + m.recruitment, 0);
    const resigned = trendMonths.reduce((sum, m) => sum + m.resigned, 0);
    const avg = (arr, key) =>
      arr.length
        ? Math.round((arr.reduce((s, d) => s + d[key], 0) / arr.length) * 10) /
          10
        : 0;
    return {
      recruited,
      resigned,
      avgLto: avg(ltoData, "lto"),
      avgAbsenteeism: avg(absenteeismData, "absenteeism"),
    };
  }, [trendMonths, ltoData, absenteeismData]);

  // Most recent daily record per factory (records arrive newest-entered
  // first, so the first hit per factoryId is its latest snapshot) - a
  // "right now" complement to the year-trend charts above, not year-scoped.
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

  // The same snapshot, narrowed to the current factory scope (a specific
  // factory, or the user's own) - "All Factories" (Administrator) keeps
  // every row, summing across the group.
  const scopedLatestByFactory = useMemo(() => {
    if (!effectiveFactoryId) return latestByFactory;
    return latestByFactory.filter(
      (r) => String(r.factoryId) === String(effectiveFactoryId),
    );
  }, [latestByFactory, effectiveFactoryId]);

  const currentHeadcount = useMemo(
    () =>
      scopedLatestByFactory.reduce(
        (sum, r) => sum + (Number(r.cmo) || 0) + (Number(r.ctmo) || 0),
        0,
      ),
    [scopedLatestByFactory],
  );

  // Group-wide (or scoped) Budget vs Allocated, from each factory's latest
  // record this month - mirrors the "Cadre Fulfilment" sheet (BUDGET /
  // ALLOCATED / CADRE FULFILMENT_%). The donut's two segments (Allocated +
  // Shortage) sum to Budget, so the Allocated slice's own share *is* the
  // Cadre Fulfilment %.
  const fulfilmentTotals = useMemo(
    () =>
      scopedLatestByFactory.reduce(
        (acc, r) => {
          acc.budget += Number(r.pt) || 0;
          acc.allocated += Number(r.at) || 0;
          return acc;
        },
        { budget: 0, allocated: 0 },
      ),
    [scopedLatestByFactory],
  );
  const fulfilmentData = useMemo(() => {
    const shortage = Math.max(
      0,
      fulfilmentTotals.budget - fulfilmentTotals.allocated,
    );
    return [
      {
        label: "Allocated",
        value: fulfilmentTotals.allocated,
        color: CHART_COLORS.aqua,
      },
      { label: "Shortage", value: shortage, color: CHART_COLORS.red },
    ];
  }, [fulfilmentTotals]);
  const fulfilmentPct = fulfilmentTotals.budget
    ? Math.round(
        (fulfilmentTotals.allocated / fulfilmentTotals.budget) * 1000,
      ) / 10
    : 0;

  const compositionData = useMemo(() => {
    const totals = scopedLatestByFactory.reduce(
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
  }, [scopedLatestByFactory]);

  // Administrator-only cross-factory comparison - always every factory
  // (this is the dedicated "compare factories" view; the Factory filter
  // above narrows everything else, not this).
  const attendanceByFactory = useMemo(
    () =>
      latestByFactory.map((r) => ({
        label: r.factory,
        values: { present: Number(r.prt) || 0, absent: Number(r.abt) || 0 },
      })),
    [latestByFactory],
  );
  const shortageByFactory = useMemo(
    () =>
      latestByFactory.map((r) => ({
        label: r.factory,
        values: { shortage: Math.max(0, Number(r.st) || 0) },
      })),
    [latestByFactory],
  );

  const scopeAndYear = `${scopeLabel} • ${selectedYear}`;

  return (
    <div>
      {/* Filter bar - Year is universal; Factory is Administrator-only (a
          general user always sees their own factory, never a picker). */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5 bg-white border border-app-border rounded-lg px-4 py-3 shadow-sm">
        <div>
          <h1 className="text-base font-bold text-app-text">Dashboard</h1>
          <p className="text-xs text-app-muted mt-0.5">
            {isAdmin
              ? "Group-wide workforce insights, by factory and year."
              : `Workforce insights for ${userFactoryName}.`}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {isAdmin && (
            <select
              value={selectedFactoryId ?? ""}
              onChange={(e) => setSelectedFactoryId(e.target.value || null)}
              className="h-9 px-3 text-xs font-semibold border border-app-border rounded-md bg-white text-app-text focus:outline-none focus:ring-2 focus:ring-sky-100 focus:border-teal"
            >
              <option value="">All Factories</option>
              {factories.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.factoryName}
                </option>
              ))}
            </select>
          )}

          <div className="flex gap-1 bg-app-bg rounded-md p-1">
            {YEAR_OPTIONS.map((y) => (
              <button
                key={y}
                type="button"
                onClick={() => setSelectedYear(y)}
                className={`px-2.5 py-1.5 rounded text-xs font-semibold transition-colors cursor-pointer ${
                  y === selectedYear
                    ? "bg-navy text-white"
                    : "text-app-muted hover:text-navy"
                }`}
              >
                {y}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI tiles - headline numbers for the selected scope/year, a
          glanceable summary before the charts below. */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mb-2">
        <StatCard
          label="Current Headcount"
          value={currentHeadcount}
          accent={0}
        />
        <StatCard
          label="Budget Fulfilment"
          value={`${fulfilmentPct}%`}
          accent={1}
        />
        <StatCard
          label={`Recruited (${selectedYear})`}
          value={kpis.recruited}
          accent={2}
        />
        <StatCard
          label={`Resigned (${selectedYear})`}
          value={kpis.resigned}
          accent={3}
        />
        {/* <StatCard
          label={`Avg. LTO Ratio (${selectedYear})`}
          value={`${kpis.avgLto}%`}
          accent={0}
        /> */}
      </div>

      <SectionHeading title="Overview" context={`${scopeLabel} • This Month`} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {canShowScoped ? (
          <>
            <Card title="Cadre Fulfilment" variant="teal">
              <div className="p-4 pt-3">
                <DonutChart data={fulfilmentData} centerLabel="Cadre Budget" />
              </div>
            </Card>
            <Card title="Current MO/TMO Composition" variant="navy">
              <div className="p-4 pt-3">
                <DonutChart
                  data={compositionData}
                  centerLabel="Current Cadre"
                />
              </div>
            </Card>
          </>
        ) : (
          <Card
            title="Cadre Fulfilment"
            variant="teal"
            className="lg:col-span-2"
          >
            <div className="py-14 text-center text-sm text-slate-400">
              No factory is assigned to your account. Contact an administrator
              to assign one.
            </div>
          </Card>
        )}
      </div>

      <SectionHeading title="Trends" context={scopeAndYear} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card title="Cadre Trend" variant="navy">
          <div className="p-4 pt-3">
            <TrendAreaChart
              data={cadreTrendData}
              formatX={formatMonthLabel}
              series={[
                {
                  key: "budget",
                  label: "Budget",
                  color: CHART_COLORS.blue,
                  dashed: true,
                },
                {
                  key: "allocated",
                  label: "Allocated",
                  color: CHART_COLORS.aqua,
                  area: true,
                },
              ]}
            />
          </div>
        </Card>

        <Card title="Recruitment & Resign" variant="orange">
          <div className="p-4 pt-3">
            <TrendAreaChart
              data={recruitResignData}
              formatX={formatMonthLabel}
              series={[
                {
                  key: "recruitment",
                  label: "Recruitment",
                  color: CHART_COLORS.aqua,
                  area: true,
                },
                { key: "resigned", label: "Resign", color: CHART_COLORS.red },
              ]}
            />
          </div>
        </Card>

        <Card title="LTO Ratio" variant="purple">
          <div className="p-4 pt-3">
            <TrendAreaChart
              data={ltoData}
              formatX={formatMonthLabel}
              series={[
                {
                  key: "lto",
                  label: "LTO Ratio (%)",
                  color: CHART_COLORS.violet,
                  area: true,
                },
              ]}
            />
          </div>
        </Card>

        <Card title="Absenteeism" variant="navy">
          <div className="p-4 pt-3">
            <TrendAreaChart
              data={absenteeismData}
              formatX={formatMonthLabel}
              series={[
                {
                  key: "absenteeism",
                  label: "Absenteeism Rate (%)",
                  color: CHART_COLORS.red,
                  area: true,
                },
              ]}
            />
          </div>
        </Card>
      </div>

      <SectionHeading title="Attrition Analysis" context={scopeAndYear} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {canShowScoped ? (
          <>
            <Card title="LTO by Length of Service" variant="green">
              <div className="p-4 pt-3">
                <DonutChart data={serviceLengthData} centerLabel="Resigned" />
              </div>
            </Card>
            <Card title="LTO by Reason" variant="orange">
              <div className="p-4 pt-3">
                <DonutChart data={reasonData} centerLabel="Resigned" />
              </div>
            </Card>
          </>
        ) : (
          <Card
            title="LTO by Length of Service"
            variant="green"
            className="lg:col-span-2"
          >
            <div className="py-14 text-center text-sm text-slate-400">
              No factory is assigned to your account. Contact an administrator
              to assign one.
            </div>
          </Card>
        )}
      </div>

      {isAdmin && (
        <>
          <SectionHeading
            title="Factory Comparison"
            context="This Month • Every Factory"
          />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card title="Attendance by Factory" variant="teal">
              <div className="p-4 pt-3">
                <BarChart
                  data={attendanceByFactory}
                  series={[
                    {
                      key: "present",
                      label: "Present",
                      color: CHART_COLORS.aqua,
                    },
                    { key: "absent", label: "Absent", color: CHART_COLORS.red },
                  ]}
                />
              </div>
            </Card>
            {/* <Card title="Shortage by Factory" variant="orange">
              <div className="p-4 pt-3">
                <BarChart
                  data={shortageByFactory}
                  series={[
                    {
                      key: "shortage",
                      label: "Shortage",
                      color: CHART_COLORS.orange,
                    },
                  ]}
                />
              </div>
            </Card> */}
          </div>
        </>
      )}
    </div>
  );
}
