/** Compact centered input used inside a CadreGroup (MO / TMO / Total cells). */
export default function GroupField({ label, total = false, className = "", ...props }) {
  return (
    <div>
      <label className="block text-center text-[10px] font-semibold text-slate-600 mb-1">{label}</label>
      <input
        className={`w-full h-[34px] text-center text-xs px-1 border border-slate-300 rounded-md
          focus:outline-none focus:ring-2 focus:ring-sky-100 focus:border-teal
          disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed
          ${total ? "bg-slate-100 font-bold text-navy-dark" : "bg-white"} ${className}`}
        {...props}
      />
    </div>
  );
}
