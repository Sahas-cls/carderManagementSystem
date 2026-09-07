import api from "./api";

export function getDesignations() {
  return api.get("/designations");
}

export function createDesignation(designation) {
  return api.post("/designations", { designation });
}

export function editDesignation(id, designation) {
  return api.put(`/designations/${id}`, { designation });
}

export function deleteDesignation(id) {
  return api.delete(`/designations/${id}`);
}
