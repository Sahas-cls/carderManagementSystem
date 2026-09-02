import { createContext, useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getCurrentUser, login as loginRequest, register as registerRequest } from "../services/authServices";
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

  const login = useCallback(async (credentials) => {
    const { user: loggedInUser, token } = await loginRequest(credentials);
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    setUser(loggedInUser);
    return loggedInUser;
  }, []);

  // Registering does NOT log the user in - the account starts inactive
  // until an admin approves it (see server/src/services/authService.js).
  const register = useCallback((details) => registerRequest(details), []);

  const value = {
    user,
    initializing,
    isAuthenticated: !!user,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
