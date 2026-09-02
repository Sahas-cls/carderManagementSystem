import api from "./api";

/** Creates a new account. It's inactive until an admin activates it (see userServices.activateUser). */
export function register({ userName, email, password }) {
  return api.post("/auth/register", { userName, email, password });
}

/** Logs in with email/password. Resolves to { user, token }. */
export function login({ email, password }) {
  return api.post("/auth/login", { email, password });
}

/** Fetches the current user for the stored token - used to restore a session on page load. */
export function getCurrentUser() {
  return api.get("/auth/me");
}
