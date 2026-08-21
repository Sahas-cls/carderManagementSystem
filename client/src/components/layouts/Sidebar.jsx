import { NavLink } from "react-router-dom";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: "▦", end: true },
  { to: "/week-entry", label: "Week Master", icon: "▦", end: true },
  { to: "/daily-entry", label: "Daily Data Entry", icon: "＋" },
  { to: "/weekly-view", label: "Weekly Data View", icon: "▤" },
];

/** Fixed left navigation rail. Collapses to a static top bar on small screens. */
export default function Sidebar() {
  return (
    <aside
      className="w-full h-auto static md:fixed md:left-0 md:top-0 md:bottom-0 md:w-[205px] lg:w-[245px]
        bg-navy-dark text-white p-[22px_14px] z-10 overflow-y-auto"
    >
      <div className="px-3 pb-[22px] border-b border-white/15 mb-[18px]">
        <h1 className="text-lg font-semibold m-0">Workforce Management</h1>
        <p className="text-[10px] opacity-70 mt-1.5 m-0">
          Cadre Planning &amp; Workforce Monitoring
        </p>
      </div>

      <div className="text-[10px] uppercase tracking-wider opacity-55 px-3 pb-2">
        Main Menu
      </div>

      <nav className="flex flex-col">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex items-center rounded-md px-3 py-3 my-0.5 text-[13px] transition-colors ${
                isActive
                  ? "bg-[#2c638f] text-white font-semibold"
                  : "text-slate-200 hover:bg-white/10"
              }`
            }
          >
            <span className="inline-block w-6 font-bold">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
