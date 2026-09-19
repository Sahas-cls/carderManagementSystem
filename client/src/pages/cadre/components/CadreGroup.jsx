const TITLE_VARIANTS = {
  gray: "bg-slate-100 text-[#29485f]",
  blue: "bg-blue-100 text-black border-b-2 border-red-400 text-red-900",
  pink: "bg-orange-soft text-[#89511d]",
  green: "bg-green-200 text-green-dark",
  red: "bg-red-100 text-black",
};

/** One boxed MO/TMO/Total group on the Cadre / Recruitment Details form. */
export default function CadreGroup({
  title,
  variant = "gray",
  columns = 3,
  full = false,
  children,
}) {
  return (
    <div
      className={`border border-slate-300 rounded-md overflow-hidden bg-white ${full ? "col-span-full" : ""}`}
    >
      <div
        className={`min-h-[49px] px-2 py-1.5 flex items-center justify-center text-center text-xs font-semibold leading-snug border-b border-slate-300 ${TITLE_VARIANTS[variant]}`}
      >
        {title}
      </div>
      <div
        className={`p-2.5 grid gap-1.5 ${columns === 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3"}`}
      >
        {children}
      </div>
    </div>
  );
}
