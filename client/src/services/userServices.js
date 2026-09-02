import api from "./api";

/** Lists every user with their role (admin-only). */
export function getUsers() {
  return api.get("/users");
}

/** Every role a user can be assigned (admin-only) - for the edit form's role dropdown. */
export function getUserRoles() {
  return api.get("/user-roles");
}

/** Edits a user's profile. `updates` is any subset of { userName, email, userRole, factoryId } (admin-only). */
export function updateUser(id, updates) {
  return api.patch(`/users/${id}`, updates);
}

/** Activates or deactivates an account (admin-only). An admin can't deactivate their own account. */
export function setUserStatus(id, isActive) {
  return api.patch(`/users/${id}/status`, { isActive });
}

/** Generates a new random password for a user and returns { user, tempPassword } (admin-only, shown once). */
export function resetPassword(id) {
  return api.post(`/users/${id}/reset-password`);
}
