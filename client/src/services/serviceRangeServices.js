import api from "./api";

export function getServiceRanges() {
  return api.get("/service-ranges");
}

export function createServiceRange(serviceRange) {
  return api.post("/service-ranges", { serviceRange });
}

export function editServiceRange(id, serviceRange) {
  return api.put(`/service-ranges/${id}`, { serviceRange });
}

export function deleteServiceRange(id) {
  return api.delete(`/service-ranges/${id}`);
}
