import api from "./api.js";

export function getFactories() {
  return api.get("/factories");
}

export function createFactory(factory) {
  return api.post("/factories", { factory });
}

export function editFactory(id, factory) {
  return api.put(`/factories/${id}`, { factory });
}

export function deleteFactory(id) {
  return api.delete(`/factories/${id}`);
}
