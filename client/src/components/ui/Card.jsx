const TITLE_VARIANTS = {
  navy: "bg-navy-dark",
  teal: "bg-teal-dark border-l-4 border-teal",
  orange: "bg-orange-dark border-l-4 border-orange",
  green: "bg-green-dark border-l-4 border-green",
  purple: "bg-purple-dark border-l-4 border-purple",
};

/**
 * Generic bordered panel with an optional colored title bar, matching the
 * `.card` / `.card-title` blocks used throughout the mockup.
 */
export default function Card({ title, variant = "navy", actions, children, className = "" }) {
  return (
    <section className={`bg-white border border-app-border rounded-lg mb-4 shadow-sm ${className}`}>
      {title && (
        <div
          className={`px-4 py-3 flex items-center justify-between gap-3 text-sm font-semibold text-white ${TITLE_VARIANTS[variant]}`}
        >
          <span>{title}</span>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}
