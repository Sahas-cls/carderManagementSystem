import { createContext, useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  changePassword as changePasswordRequest,
  getCurrentUser,
  login as loginRequest,
  register as registerRequest,
} from "../services/authServices";
import { TOKEN_STORAGE_KEY } from "../services/api";

// eslint-disable-next-line react-refresh/only-export-components -- consumed via hooks/useAuth.js
export const AuthContext = createContext(null);

/**
 * App-wide auth state: current user, session bootstrap from a stored JWT,
 * and login/register/logout. Must be rendered inside a Router (uses
 * useNavigate for the logout/session-expired redirect).
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);
  const navigate = useNavigate();

  // Restore the session from a stored token on first load.
  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const token = localStorage.getItem(TOKEN_STORAGE_KEY);
      if (!token) {
        if (!cancelled) setInitializing(false);
        return;
      }
      try {
        const { user: currentUser } = await getCurrentUser();
        if (!cancelled) setUser(currentUser);
      } catch {
        if (!cancelled) localStorage.removeItem(TOKEN_STORAGE_KEY);
      } finally {
        if (!cancelled) setInitializing(false);
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setUser(null);
    navigate("/login", { replace: true });
  }, [navigate]);

  // A 401 from any API call (expired/invalid token) - clear the session and
  // bounce to /login, same as an explicit logout.
  useEffect(() => {
    const handleUnauthorized = () => {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      setUser(null);
      navigate("/login", { replace: true });
    };
    window.addEventListener("auth:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("auth:unauthorized", handleUnauthorized);
  }, [navigate]);

  // An admin reset this account's password mid-session (server rejected a
  // request with MUST_CHANGE_PASSWORD - our local `user` may still say
  // mustChangePassword: false since it was read at login/bootstrap). Refetch
  // it so ProtectedRoute's redirect logic sees the up-to-date flag, then send
  // them to change it.
  useEffect(() => {
    const handleMustChangePassword = async () => {
      try {
        const { user: currentUser } = await getCurrentUser();
        setUser(currentUser);
      } catch {
        // Ignore - if /auth/me also fails the next request will surface it.
      }
      navigate("/change-password", { replace: true });
    };
    window.addEventListener("auth:mustChangePassword", handleMustChangePassword);
    return () => window.removeEventListener("auth:mustChangePassword", handleMustChangePassword);
  }, [navigate]);

  const login = useCallback(async (credentials) => {
    const { user: loggedInUser, token } = await loginRequest(credentials);
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    setUser(loggedInUser);
    return loggedInUser;
  }, []);

  // Registering does NOT log the user in - the account starts inactive
  // until an admin approves it (see server/src/services/authService.js).
  const register = useCallback((details) => registerRequest(details), []);

  // Sets a new password and clears mustChangePassword (forced after an admin
  // reset - see ChangePasswordPage/ProtectedRoute). Refetches the user so the
  // cleared flag is reflected locally right away.
  const changePassword = useCallback(async (credentials) => {
    await changePasswordRequest(credentials);
    const { user: currentUser } = await getCurrentUser();
    setUser(currentUser);
  }, []);

  const value = {
    user,
    initializing,
    isAuthenticated: !!user,
    login,
    register,
    changePassword,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
