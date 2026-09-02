import { Outlet } from "react-router-dom";

/** Shared chrome for /login and /register: a branding panel plus a centered form card. */
export default function AuthLayout() {
  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-app-bg">
      <div className="md:w-2/5 bg-navy-dark text-white flex flex-col justify-center px-8 py-12 md:px-12">
        <h1 className="text-2xl md:text-3xl font-semibold mb-3">Workforce Management</h1>
        <p className="text-sm text-slate-200/80 max-w-sm">
          Cadre Planning &amp; Workforce Monitoring — plan, track and report on factory workforce cadre in one
          place.
        </p>
      </div>
      <div className="flex-1 flex items-center justify-center px-4 py-10 md:py-0">
        <div className="w-full max-w-md">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
