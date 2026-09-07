import { useId, useRef, useState } from "react";
import { CHART_INK, formatShortDate } from "./chartTheme";

const W = 640;
const H = 280;
const PAD = { top: 20, right: 30, bottom: 30, left: 40 };

/** Catmull-Rom -> cubic Bezier smoothing (tension 1/6) - a gentle curve through every point, not an approximation that misses them. */
function smoothPath(points) {
  if (points.length < 2) return "";
  if (points.length === 2) return `M ${points[0][0]} ${points[0][1]} L ${points[1][0]} ${points[1][1]}`;

  let d = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? i : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2 < points.length ? i + 2 : i + 1];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2[0]} ${p2[1]}`;
  }
  return d;
}

/**
 * Multi-line/area trend chart plotted across dates on a single shared y-axis.
 * `data` is `[{ date, [seriesKey]: n, ... }]`, already sorted oldest -> newest.
 * `series` is `[{ key, label, color, dashed?, area? }]` (1 or more series,
 * same unit/axis) - mirrors BarChart's `series` convention. At most one
 * series should set `area: true` (its line gets the soft gradient fill
 * under it, like Current Total did before this became reusable). `date` may
 * hold anything unique and orderable (a day, a "YYYY-MM" month, ...) -
 * `formatX` controls how it's rendered on the axis/tooltip, defaulting to
 * the day-of-month `formatShortDate`. A crosshair + tooltip tracks the
 * pointer continuously across the plot (see the data-viz skill's
 * interaction.md) rather than snapping per data point only on entry.
 */
export default function TrendAreaChart({ data, series, formatX = formatShortDate }) {
  const gradientId = useId();
  const svgRef = useRef(null);
  const [hoverIdx, setHoverIdx] = useState(null);

  if (!data.length) {
    return <div className="py-14 text-center text-sm text-slate-400">No data to show yet.</div>;
  }

  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const maxVal = Math.max(1, ...data.flatMap((d) => series.map((s) => d[s.key] || 0))) * 1.15;

  const x = (i) => PAD.left + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const y = (v) => PAD.top + innerH - (v / maxVal) * innerH;

  const linePath = (key) => smoothPath(data.map((d, i) => [x(i), y(d[key] || 0)]));
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
  const areaSeries = series.find((s) => s.area);

  const nearestIndexForClientX = (clientX) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const fraction = (clientX - rect.left) / rect.width;
    const viewBoxX = fraction * W;
    if (data.length === 1) return 0;
    const idxFloat = ((viewBoxX - PAD.left) / innerW) * (data.length - 1);
    return Math.min(data.length - 1, Math.max(0, Math.round(idxFloat)));
  };

  // Flip the tooltip to the left half once the crosshair passes the
  // midpoint, so it never runs off the right edge of the chart.
  const tooltipOnLeft = hoverIdx !== null && hoverIdx > (data.length - 1) / 2;

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto cursor-crosshair"
        role="img"
        aria-label="Trend chart"
        onMouseMove={(e) => setHoverIdx(nearestIndexForClientX(e.clientX))}
        onMouseLeave={() => setHoverIdx(null)}
      >
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

        {areaSeries && (
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={areaSeries.color} stopOpacity="0.32" />
              <stop offset="100%" stopColor={areaSeries.color} stopOpacity="0" />
            </linearGradient>
          </defs>
        )}

        {areaSeries && <path d={areaPath(areaSeries.key)} fill={`url(#${gradientId})`} stroke="none" />}
        {series.map((s) => (
          <path
            key={s.key}
            d={linePath(s.key)}
            fill="none"
            stroke={s.color}
            strokeWidth={s.area ? 2.5 : 2}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={s.dashed ? "5 4" : undefined}
          />
        ))}

        {/* Direct end-of-line labels - the latest value read at a glance, no hover required. */}
        {series.map((s) => {
          const last = data[data.length - 1];
          const val = last[s.key] || 0;
          return (
            <text
              key={`end-${s.key}`}
              x={x(data.length - 1) + 4}
              y={y(val) + 3}
              fontSize="9.5"
              fontWeight="700"
              fill={s.color}
            >
              {val}
            </text>
          );
        })}

        {hoverIdx !== null && (
          <line
            x1={x(hoverIdx)}
            x2={x(hoverIdx)}
            y1={PAD.top}
            y2={PAD.top + innerH}
            stroke={CHART_INK.axis}
            strokeWidth="1"
            strokeDasharray="3 3"
          />
        )}

        {/* Transparent full-plot capture surface - hover tracks continuously, not per bucket. */}
        <rect
          x={PAD.left}
          y={PAD.top}
          width={innerW}
          height={innerH}
          fill="transparent"
        />

        {data.map((d, i) => (
          <g key={d.date}>
            {i % labelStep === 0 && (
              <text x={x(i)} y={H - 10} textAnchor="middle" fontSize="9" fill={CHART_INK.muted}>
                {formatX(d.date)}
              </text>
            )}
            {hoverIdx === i &&
              series.map((s) => (
                <circle
                  key={s.key}
                  cx={x(i)}
                  cy={y(d[s.key] || 0)}
                  r="4.5"
                  fill={s.color}
                  stroke="#fff"
                  strokeWidth="2"
                />
              ))}
          </g>
        ))}
      </svg>

      {hovered && (
        <div
          className={`absolute top-2 bg-white border border-app-border rounded-md shadow-md px-2.5 py-2 text-[11px] leading-relaxed pointer-events-none transition-[left] duration-75 ${
            tooltipOnLeft ? "-translate-x-full" : ""
          }`}
          style={{ left: `${(x(hoverIdx) / W) * 100}%`, marginLeft: tooltipOnLeft ? -10 : 10 }}
        >
          <div className="font-semibold text-app-text mb-0.5">{formatX(hovered.date)}</div>
          {series.map((s) => (
            <div key={s.key} className="text-app-muted flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
              {s.label}: <b className="text-app-text">{hovered[s.key] || 0}</b>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-4 justify-center pt-1.5 text-[10.5px] text-app-muted">
        {series.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-0.5 rounded-full" style={{ background: s.color }} /> {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
