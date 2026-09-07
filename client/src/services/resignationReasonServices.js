import api from "./api";

export function getResignationReasons() {
  return api.get("/resignation-reasons");
}

export function createResignationReason(reason) {
  return api.post("/resignation-reasons", { reason });
}

export function editResignationReason(id, reason) {
  return api.put(`/resignation-reasons/${id}`, { reason });
}

export function deleteResignationReason(id) {
  return api.delete(`/resignation-reasons/${id}`);
}
