const ACCENTS = ["bg-teal", "bg-orange", "bg-green", "bg-purple"];

/** Dashboard KPI tile with a colored left accent bar. */
export default function StatCard({ label, value, accent = 0 }) {
  return (
    <div className="relative bg-white border border-app-border rounded-lg p-4.5 overflow-hidden">
      <span className={`absolute left-0 top-0 bottom-0 w-[5px] ${ACCENTS[accent % ACCENTS.length]}`} />
      <div className="text-[11px] text-app-muted">{label}</div>
      <div className="text-[28px] font-bold mt-2 text-navy-dark leading-none">{value}</div>
    </div>
  );
}
