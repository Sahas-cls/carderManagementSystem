import { Outlet, useLocation } from "react-router-dom";
import Header from "../components/layouts/Header";
import Sidebar from "../components/layouts/Sidebar";

const PAGE_META = {
  "/": { title: "Dashboard", subtitle: "Workforce overview and cadre monitoring" },
  "/daily-entry": { title: "Daily Data Entry", subtitle: "Enter and manage daily cadre records" },
  "/weekly-view": { title: "Weekly Data View", subtitle: "Automatically updated weekly workforce records" },
  "/manage-users": { title: "Manage Users", subtitle: "Activate accounts and review roles" },
};

/** App shell: sidebar + header + routed page content. */
export default function UserLayout() {
  const { pathname } = useLocation();
  const meta = PAGE_META[pathname] ?? PAGE_META["/"];

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-app-bg text-app-text">
      <Sidebar />
      <div className="flex-1 min-w-0 md:ml-[205px] lg:ml-[245px]">
        <Header title={meta.title} subtitle={meta.subtitle} />
        <main className="max-w-[1600px] mx-auto px-6 max-md:px-4 py-6 pb-12">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
