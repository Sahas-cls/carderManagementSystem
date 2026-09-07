import { useState } from "react";
import { CHART_INK } from "./chartTheme";

const H = 260;
const PAD = { top: 26, right: 16, bottom: 44, left: 40 };
const BAR_GAP = 0.28; // fraction of each group's width left as whitespace

/**
 * Grouped vertical bar chart. `data` is `[{ label, values: { seriesKey: n } }]`,
 * `series` is `[{ key, label, color }]` (1 or more series, same unit/axis).
 */
export default function BarChart({ data, series, width = 640 }) {
  const [hover, setHover] = useState(null); // { groupIdx, seriesKey }

  if (!data.length) {
    return <div className="py-14 text-center text-sm text-slate-400">No data to show yet.</div>;
  }

  const innerW = width - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const maxVal = Math.max(1, ...data.flatMap((d) => series.map((s) => d.values[s.key] || 0))) * 1.15;

  const groupW = innerW / data.length;
  const barW = (groupW * (1 - BAR_GAP)) / series.length;
  const y = (v) => PAD.top + innerH - (v / maxVal) * innerH;

  const ticks = 4;
  const gridLines = Array.from({ length: ticks + 1 }, (_, i) => {
    const v = (maxVal / ticks) * i;
    return { v: Math.round(v), yPos: y(v) };
  });

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${H}`} className="w-full h-auto" role="img" aria-label="Bar chart">
        {gridLines.map((g) => (
          <g key={g.v}>
            <line x1={PAD.left} x2={width - PAD.right} y1={g.yPos} y2={g.yPos} stroke={CHART_INK.grid} strokeWidth="1" />
            <text x={PAD.left - 8} y={g.yPos + 3} textAnchor="end" fontSize="9" fill={CHART_INK.muted}>
              {g.v}
            </text>
          </g>
        ))}
        <line
          x1={PAD.left}
          x2={width - PAD.right}
          y1={PAD.top + innerH}
          y2={PAD.top + innerH}
          stroke={CHART_INK.axis}
          strokeWidth="1"
        />

        {data.map((d, gi) => {
          const groupX = PAD.left + gi * groupW + (groupW * BAR_GAP) / 2;
          return (
            <g key={d.label}>
              {series.map((s, si) => {
                const val = d.values[s.key] || 0;
                const bx = groupX + si * barW;
                const bh = PAD.top + innerH - y(val);
                const isHover = hover && hover.groupIdx === gi && hover.seriesKey === s.key;
                return (
                  <g key={s.key}>
                    <rect
                      x={bx}
                      y={y(val)}
                      width={Math.max(0, barW - 2)}
                      height={Math.max(0, bh)}
                      rx="4"
                      fill={s.color}
                      opacity={isHover ? 1 : 0.9}
                      className="transition-opacity duration-100"
                      onMouseEnter={() => setHover({ groupIdx: gi, seriesKey: s.key })}
                      onMouseLeave={() => setHover(null)}
                    >
                      <title>
                        {d.label} — {s.label}: {val}
                      </title>
                    </rect>
                    {/* Direct value label - read the number without hovering. */}
                    <text
                      x={bx + (barW - 2) / 2}
                      y={y(val) - 5}
                      textAnchor="middle"
                      fontSize="9.5"
                      fontWeight="700"
                      fill={isHover ? s.color : CHART_INK.muted}
                    >
                      {val}
                    </text>
                  </g>
                );
              })}
              <text
                x={groupX + (barW * series.length) / 2}
                y={PAD.top + innerH + 14}
                textAnchor="middle"
                fontSize="9"
                fill={CHART_INK.muted}
              >
                {d.label.length > 12 ? `${d.label.slice(0, 11)}…` : d.label}
              </text>
            </g>
          );
        })}
      </svg>

      {series.length > 1 && (
        <div className="flex gap-4 justify-center pt-1 text-[10.5px] text-app-muted">
          {series.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
