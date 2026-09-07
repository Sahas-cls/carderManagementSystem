import api from "./api";

export function getSections() {
  return api.get("/sections");
}

export function createSection(section) {
  return api.post("/sections", { section });
}

export function editSection(id, section) {
  return api.put(`/sections/${id}`, { section });
}

export function deleteSection(id) {
  return api.delete(`/sections/${id}`);
}
