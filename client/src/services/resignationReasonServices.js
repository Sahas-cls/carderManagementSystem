import api from "./api";

/** `transferRelated` (true/false) narrows to just that flag - omit for every reason. */
export function getResignationReasons(transferRelated) {
  if (transferRelated === undefined) return api.get("/resignation-reasons");
  return api.get("/resignation-reasons", { params: { transferRelated } });
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
