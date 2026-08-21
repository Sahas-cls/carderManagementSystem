/** Labeled text/date/number input used on the "Record Information" style fields. */
export function FieldInput({ label, className = "", labelClassName = "", ...props }) {
  return (
    <div>
      <label className={`block text-[11px] font-semibold text-slate-600 mb-1.5 ${labelClassName}`}>{label}</label>
      <input
        className={`w-full h-[37px] border border-slate-300 rounded-md px-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-100 focus:border-teal disabled:bg-slate-100 ${className}`}
        {...props}
      />
    </div>
  );
}

/** Labeled select input, same footprint as FieldInput. */
export function FieldSelect({ label, className = "", children, ...props }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">{label}</label>
      <select
        className={`w-full h-[37px] border border-slate-300 rounded-md px-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-100 focus:border-teal ${className}`}
        {...props}
      >
        {children}
      </select>
    </div>
  );
}
