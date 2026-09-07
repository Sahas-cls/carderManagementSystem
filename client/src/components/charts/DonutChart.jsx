import { useState } from "react";
import { CHART_INK } from "./chartTheme";

const SIZE = 200;
const CX = SIZE / 2;
const CY = SIZE / 2;
const R = 76;
const STROKE = 26;
const STROKE_HOVER = 30;

function polarToXY(cx, cy, r, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

function arcPath(cx, cy, r, startDeg, endDeg) {
  const [x1, y1] = polarToXY(cx, cy, r, startDeg);
  const [x2, y2] = polarToXY(cx, cy, r, endDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
}

/**
 * Donut/ring chart with a centered total. `data` is `[{ label, value, color }]`.
 * Hovering a segment (or its legend row) swaps the center label to that
 * segment's own value/share and lifts its stroke - a quick way to read one
 * category without losing the whole-picture total, which comes back on
 * mouse-leave.
 */
export default function DonutChart({ data, centerLabel }) {
  const [hoverLabel, setHoverLabel] = useState(null);
  const total = data.reduce((sum, d) => sum + d.value, 0);

  if (!total) {
    return <div className="py-14 text-center text-sm text-slate-400">No data to show yet.</div>;
  }

  // Leave a 2deg gap between segments (surface gap, per the segment-spacing rule).
  const gapDeg = data.length > 1 ? 2 : 0;
  const segments = data
    .filter((d) => d.value > 0)
    .reduce((acc, d) => {
      const cursor = acc.length ? acc[acc.length - 1].cursorEnd : 0;
      const sweep = (d.value / total) * 360;
      const start = cursor + gapDeg / 2;
      const end = cursor + sweep - gapDeg / 2;
      acc.push({
        ...d,
        start,
        end: Math.max(start, end),
        cursorEnd: cursor + sweep,
        pct: Math.round((d.value / total) * 100),
      });
      return acc;
    }, []);

  const hovered = hoverLabel ? segments.find((s) => s.label === hoverLabel) : null;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-5 justify-center">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="w-[170px] h-[170px] shrink-0"
        role="img"
        aria-label="Composition donut chart"
      >
        {segments.map((s) => (
          <path
            key={s.label}
            d={arcPath(CX, CY, R, s.start, s.end)}
            fill="none"
            stroke={s.color}
            strokeWidth={hoverLabel === s.label ? STROKE_HOVER : STROKE}
            strokeLinecap="round"
            opacity={hoverLabel && hoverLabel !== s.label ? 0.4 : 1}
            className="transition-all duration-150 cursor-pointer"
            onMouseEnter={() => setHoverLabel(s.label)}
            onMouseLeave={() => setHoverLabel((cur) => (cur === s.label ? null : cur))}
          >
            <title>
              {s.label}: {s.value} ({s.pct}%)
            </title>
          </path>
        ))}
        {hovered ? (
          <>
            <text x={CX} y={CY - 4} textAnchor="middle" fontSize="20" fontWeight="700" fill={hovered.color}>
              {hovered.pct}%
            </text>
            <text x={CX} y={CY + 15} textAnchor="middle" fontSize="9.5" fill={CHART_INK.muted}>
              {hovered.label.length > 16 ? `${hovered.label.slice(0, 15)}…` : hovered.label}
            </text>
          </>
        ) : (
          <>
            <text x={CX} y={CY - 4} textAnchor="middle" fontSize="22" fontWeight="700" fill={CHART_INK.primary}>
              {total}
            </text>
            <text x={CX} y={CY + 15} textAnchor="middle" fontSize="10" fill={CHART_INK.muted}>
              {centerLabel}
            </text>
          </>
        )}
      </svg>

      <div className="flex flex-col gap-2 text-[11.5px]">
        {segments.map((s) => (
          <div
            key={s.label}
            className={`flex items-center gap-2 rounded-md px-1.5 py-0.5 -mx-1.5 cursor-pointer transition-colors ${
              hoverLabel === s.label ? "bg-app-bg" : ""
            }`}
            onMouseEnter={() => setHoverLabel(s.label)}
            onMouseLeave={() => setHoverLabel((cur) => (cur === s.label ? null : cur))}
          >
            <span className="inline-block w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: s.color }} />
            <span className={hoverLabel === s.label ? "text-app-text font-semibold" : "text-app-text"}>
              {s.label}
            </span>
            <span className="text-app-muted">
              {s.value} ({s.pct}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
