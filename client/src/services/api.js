import axios from "axios";

const TOKEN_STORAGE_KEY = "authToken";

// Shared axios instance for every service module. Points at the Node
// backend's REST API (see server/app.js), base URL configurable per
// environment via VITE_API_BASE_URL.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api",
  headers: { "Content-Type": "application/json" },
});

// Attach the JWT (if we have one) to every outgoing request.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Every backend response is shaped as { success, data } or { success, message }.
// Unwrap that here so callers just get the data (or a thrown Error with a
// readable message). A 401 means the session is gone (expired/invalid token)
// - broadcast it so AuthContext can clear state and redirect to /login
// without every single service call needing to know about that.
api.interceptors.response.use(
  (response) => response.data?.data ?? response.data,
  (error) => {
    const message = error.response?.data?.message || error.message || "Request failed.";
    if (error.response?.status === 401) {
      window.dispatchEvent(new CustomEvent("auth:unauthorized"));
    }
    return Promise.reject(new Error(message));
  }
);

export default api;
export { TOKEN_STORAGE_KEY };
