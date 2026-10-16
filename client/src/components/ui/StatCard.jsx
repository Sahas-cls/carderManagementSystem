const ACCENTS = ["bg-teal", "bg-orange", "bg-green", "bg-purple"];

/**
 * Dashboard KPI tile with a colored left accent bar. `breakdown` (optional,
 * [{ label, value }]) shows as a small popover when the tile is hovered or
 * focused.
 */
export default function StatCard({ label, value, accent = 0, breakdown }) {
  return (
    <div className="relative group" tabIndex={breakdown ? 0 : undefined}>
      <div className="relative bg-white border border-app-border rounded-lg p-4.5 overflow-hidden h-full">
        <span className={`absolute left-0 top-0 bottom-0 w-[5px] ${ACCENTS[accent % ACCENTS.length]}`} />
        <div className="text-[11px] text-app-muted">{label}</div>
        <div className="text-[28px] font-bold mt-2 text-navy-dark leading-none">{value}</div>
      </div>
      {breakdown && (
        <div className="pointer-events-none absolute left-0 right-0 top-full mt-1 z-20 hidden group-hover:block group-focus:block bg-white border border-app-border rounded-lg shadow-lg p-3">
          {breakdown.map((b) => (
            <div key={b.label} className="flex items-center justify-between text-xs py-0.5">
              <span className="text-app-muted">{b.label}</span>
              <span className="font-bold text-navy-dark">{b.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
