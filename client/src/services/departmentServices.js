import api from "./api";

export function getDepartments(factoryId) {
  return api.get("/departments", { params: factoryId ? { factoryId } : undefined });
}

export function createDepartment(department) {
  return api.post("/departments", { department });
}

export function editDepartment(id, department) {
  return api.put(`/departments/${id}`, { department });
}

export function deleteDepartment(id) {
  return api.delete(`/departments/${id}`);
}
