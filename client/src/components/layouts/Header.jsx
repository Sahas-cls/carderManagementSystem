/** Sticky top bar showing the current page's title/subtitle. */
export default function Header({ title, subtitle }) {
  return (
    <header
      className="h-[74px] max-md:h-auto bg-white border-b border-app-border flex items-center justify-between
        px-7 max-md:px-4 max-md:py-4 sticky top-0 z-[5]"
    >
      <div>
        <h2 className="m-0 text-xl font-semibold text-navy-dark">{title}</h2>
        <p className="mt-1 mb-0 text-[11px] text-app-muted">{subtitle}</p>
      </div>
    </header>
  );
}
