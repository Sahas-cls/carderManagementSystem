const VARIANTS = {
  default:
    "bg-white border border-slate-300 text-navy-dark hover:bg-slate-50 hover:border-slate-400 hover:text-navy",
  primary: "bg-navy text-white border border-transparent hover:bg-navy-dark",
  teal: "bg-teal text-white border border-transparent hover:bg-teal-dark",
  orange: "bg-orange text-white border border-transparent hover:bg-orange-dark",
  edit: "bg-white border border-slate-300 text-navy hover:bg-sky-50 hover:border-slate-400 hover:text-navy-dark",
  delete:
    "bg-white border border-slate-300 text-red-600 hover:bg-red-50 hover:border-red-300 hover:text-red-700",
  success:
    "bg-green-500 border border-slate-300 text-white hover:bg-green-50 hover:border-red-300 hover:text-white",
};

/** Shared action button - pass `variant` to match the mockup's color-coded buttons. */
export default function Button({
  variant = "default",
  small = false,
  className = "",
  ...props
}) {
  return (
    <button
      type="button"
      className={`h-9 rounded-md text-xs font-semibold cursor-pointer transition-colors duration-150 disabled:opacity-55 disabled:cursor-not-allowed ${
        small ? "min-w-[76px] px-3" : "min-w-[118px] px-4"
      } ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}
