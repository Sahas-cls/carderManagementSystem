import { useId, useState } from "react";
import { CHART_COLORS, CHART_INK, formatShortDate } from "./chartTheme";

const W = 640;
const H = 260;
const PAD = { top: 16, right: 16, bottom: 30, left: 40 };

/**
 * Two-line/area trend chart (planned vs current headcount) plotted across
 * dates on a single shared y-axis. `data` is `[{ date, planned, current }]`,
 * already sorted oldest -> newest.
 */
export default function TrendAreaChart({ data }) {
  const gradientId = useId();
  const [hoverIdx, setHoverIdx] = useState(null);

  if (!data.length) {
    return <div className="py-14 text-center text-sm text-slate-400">No data for this month yet.</div>;
  }

  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const maxVal = Math.max(1, ...data.map((d) => Math.max(d.planned, d.current))) * 1.15;

  const x = (i) => PAD.left + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const y = (v) => PAD.top + innerH - (v / maxVal) * innerH;

  const linePath = (key) => data.map((d, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(d[key])}`).join(" ");
  const areaPath = (key) =>
    `${linePath(key)} L ${x(data.length - 1)} ${PAD.top + innerH} L ${x(0)} ${PAD.top + innerH} Z`;

  const ticks = 4;
  const gridLines = Array.from({ length: ticks + 1 }, (_, i) => {
    const v = (maxVal / ticks) * i;
    return { v: Math.round(v), yPos: y(v) };
  });

  // Skip labels so at most ~8 show, evenly spaced.
  const labelStep = Math.max(1, Math.ceil(data.length / 8));
  const hovered = hoverIdx !== null ? data[hoverIdx] : null;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Planned vs current headcount trend">
        {gridLines.map((g) => (
          <g key={g.v}>
            <line x1={PAD.left} x2={W - PAD.right} y1={g.yPos} y2={g.yPos} stroke={CHART_INK.grid} strokeWidth="1" />
            <text x={PAD.left - 8} y={g.yPos + 3} textAnchor="end" fontSize="9" fill={CHART_INK.muted}>
              {g.v}
            </text>
          </g>
        ))}
        <line
          x1={PAD.left}
          x2={W - PAD.right}
          y1={PAD.top + innerH}
          y2={PAD.top + innerH}
          stroke={CHART_INK.axis}
          strokeWidth="1"
        />

        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART_COLORS.orange} stopOpacity="0.28" />
            <stop offset="100%" stopColor={CHART_COLORS.orange} stopOpacity="0" />
          </linearGradient>
        </defs>

        <path d={areaPath("current")} fill={`url(#${gradientId})`} stroke="none" />
        <path d={linePath("planned")} fill="none" stroke={CHART_COLORS.blue} strokeWidth="2" strokeDasharray="5 4" />
        <path d={linePath("current")} fill="none" stroke={CHART_COLORS.orange} strokeWidth="2.5" />

        {data.map((d, i) => (
          <g key={d.date}>
            <rect
              x={x(i) - innerW / data.length / 2}
              y={PAD.top}
              width={innerW / data.length || innerW}
              height={innerH}
              fill="transparent"
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx((cur) => (cur === i ? null : cur))}
            />
            {i % labelStep === 0 && (
              <text x={x(i)} y={H - 10} textAnchor="middle" fontSize="9" fill={CHART_INK.muted}>
                {formatShortDate(d.date)}
              </text>
            )}
            {hoverIdx === i && (
              <>
                <line x1={x(i)} x2={x(i)} y1={PAD.top} y2={PAD.top + innerH} stroke={CHART_INK.axis} strokeWidth="1" />
                <circle cx={x(i)} cy={y(d.planned)} r="3.5" fill={CHART_COLORS.blue} />
                <circle cx={x(i)} cy={y(d.current)} r="3.5" fill={CHART_COLORS.orange} />
              </>
            )}
          </g>
        ))}
      </svg>

      {hovered && (
        <div className="absolute top-2 right-2 bg-white border border-app-border rounded-md shadow-sm px-2.5 py-2 text-[11px] leading-relaxed pointer-events-none">
          <div className="font-semibold text-app-text">{formatShortDate(hovered.date)}</div>
          <div className="text-app-muted">
            <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: CHART_COLORS.blue }} />
            Planned: <b>{hovered.planned}</b>
          </div>
          <div className="text-app-muted">
            <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: CHART_COLORS.orange }} />
            Current: <b>{hovered.current}</b>
          </div>
        </div>
      )}

      <div className="flex gap-4 justify-center pt-1 text-[10.5px] text-app-muted">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-0.5" style={{ background: CHART_COLORS.blue }} /> Planned Total
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-0.5" style={{ background: CHART_COLORS.orange }} /> Current Total
        </span>
      </div>
    </div>
  );
}
