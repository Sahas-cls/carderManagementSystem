import { NavLink } from "react-router-dom";
import { TbLayoutDashboard } from "react-icons/tb";
import { FaCalendar } from "react-icons/fa6";
import { GrDatabase } from "react-icons/gr";
import { MdPreview } from "react-icons/md";
import { FaUsersGear } from "react-icons/fa6";
import { MdOutlineFactory } from "react-icons/md";
import { HiOutlineLogout } from "react-icons/hi";
import { GrLineChart } from "react-icons/gr";
import { TbListDetails } from "react-icons/tb";
import { GiDuration } from "react-icons/gi";
import { MdWorkOutline, MdBusiness, MdViewModule } from "react-icons/md";
import useAuth from "../../hooks/useAuth";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: <TbLayoutDashboard />, end: true },
  { to: "/week-entry", label: "Week Master", icon: <FaCalendar />, end: true },
  { to: "/daily-entry", label: "Daily Data Entry", icon: <GrDatabase /> },
  { to: "/weekly-view", label: "Weekly Data View", icon: <MdPreview /> },
];

const AD_NAV_ITEMS = [
  {
    to: "/manage-users",
    label: "Users",
    icon: <FaUsersGear />,
    end: true,
  },

  // Master Data
  {
    to: "/factory-master",
    label: "Factory Master",
    icon: <MdOutlineFactory />,
    end: true,
  },
  {
    to: "/department-master",
    label: "Department Master",
    icon: <MdBusiness />,
    end: true,
  },
  {
    to: "/section-master",
    label: "Section Master",
    icon: <MdViewModule />,
    end: true,
  },
  {
    to: "/designation-master",
    label: "Designation Master",
    icon: <MdWorkOutline />,
    end: true,
  },
  {
    to: "/service-master",
    label: "Service Range",
    icon: <GiDuration />,
    end: true,
  },
  {
    to: "/budget-master",
    label: "Budget Master",
    icon: <GrLineChart />,
    end: true,
  },
  {
    to: "/resignation-reasons",
    label: "Resignation Reasons",
    icon: <TbListDetails />,
    end: true,
  },
];

const navLinkClass = ({ isActive }) =>
  `flex items-center rounded-md px-3 py-3 my-0.5 text-[13px] transition-colors ${
    isActive
      ? "bg-[#2c638f] text-white font-semibold"
      : "text-slate-200 hover:bg-white/10"
  }`;

/** Fixed left navigation rail. Collapses to a static top bar on small screens. */
export default function Sidebar() {
  const { user, logout } = useAuth();
  const isAdmin = user?.role?.userRole === "Administrator";

  return (
    <aside
      className="w-full h-auto static md:fixed md:left-0 md:top-0 md:bottom-0 md:w-[205px] lg:w-[245px]
        bg-navy-dark text-white p-[22px_14px] z-10 overflow-y-auto flex flex-col"
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
            className={navLinkClass}
          >
            <span className="inline-block w-10 font-bold">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      {isAdmin && (
        <>
          <div className="text-[10px] uppercase tracking-wider opacity-55 px-3 pb-2 mt-4">
            Admin
          </div>

          <nav className="flex flex-col">
            {AD_NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={navLinkClass}
              >
                <span className="inline-block w-10 font-bold">{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
          </nav>
        </>
      )}

      <div className="flex-1" />

      {user && (
        <div className="pt-4 mt-4 border-t border-white/15 px-3">
          <p className="text-[13px] font-semibold m-0 truncate">
            {user.userName}
          </p>
          <p className="text-[10px] opacity-70 m-0 truncate">
            {user.role?.userRole || "—"}
          </p>
          <button
            type="button"
            onClick={logout}
            className="mt-3 flex items-center gap-2 text-[12px] text-slate-200 hover:text-white transition-colors cursor-pointer"
          >
            <HiOutlineLogout className="text-base" />
            Log Out
          </button>
        </div>
      )}
    </aside>
  );
}
