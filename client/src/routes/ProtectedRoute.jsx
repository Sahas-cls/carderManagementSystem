import { Navigate, Outlet, useLocation } from "react-router-dom";
import useAuth from "../hooks/useAuth";

/**
 * Gate for authenticated (and optionally role-restricted) routes.
 * Usage: <Route element={<ProtectedRoute />}>...</Route>, or
 * <Route element={<ProtectedRoute roles={["Administrator"]} />}>...</Route>.
 */
export default function ProtectedRoute({ roles }) {
  const { user, isAuthenticated, initializing } = useAuth();
  const location = useLocation();

  if (initializing) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-app-muted">
        Loading…
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // An admin-reset password forces the account through /change-password
  // before anything else - see server/src/middleware/auth.js's matching gate.
  if (user.mustChangePassword && location.pathname !== "/change-password") {
    return <Navigate to="/change-password" replace />;
  }
  if (!user.mustChangePassword && location.pathname === "/change-password") {
    return <Navigate to="/" replace />;
  }

  if (roles && !roles.includes(user.role?.userRole)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
