/** Small pill used inline in card titles, e.g. "12 records". */
export function CountBadge({ children }) {
  return (
    <span className="bg-white/15 text-white px-2.5 py-1 rounded-full text-[10px] font-semibold whitespace-nowrap">
      {children}
    </span>
  );
}

/** Teal-tinted badge used for row summaries (e.g. dashboard recent weeks list). */
export function Badge({ children, className = "" }) {
  return (
    <span className={`px-2.5 py-1 rounded-full text-[10px] font-medium bg-teal-soft text-teal-dark ${className}`}>
      {children}
    </span>
  );
}
