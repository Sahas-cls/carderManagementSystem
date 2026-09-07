"use strict";

const { Department, Factory } = require("../../models");
const ApiError = require("../utils/ApiError");

const FACTORY_INCLUDE = [{ model: Factory, as: "factory", attributes: ["id", "factoryName"] }];

/** Returns departments, ordered by name, optionally scoped to one factory (a Department always belongs to a factory). */
async function getAllDepartments({ factoryId } = {}) {
  const where = {};
  if (factoryId) where.factoryId = factoryId;
  return Department.findAll({
    where,
    include: FACTORY_INCLUDE,
    order: [["departmentName", "ASC"]],
  });
}

async function getDepartmentOr404(id) {
  const department = await Department.findByPk(id, { include: FACTORY_INCLUDE });
  if (!department) {
    throw new ApiError(404, `Department ${id} not found.`);
  }
  return department;
}

/** Rejects a duplicate department name within the same factory, excluding `excludeId` on updates - the same name is fine across different factories. */
async function assertDepartmentAvailable(factoryId, departmentName, excludeId) {
  const existing = await Department.findOne({ where: { factoryId, departmentName } });
  if (existing && existing.id !== excludeId) {
    throw new ApiError(409, `Department "${departmentName}" already exists for this factory.`);
  }
}

async function createDepartment({ factoryId, departmentName }) {
  await assertDepartmentAvailable(factoryId, departmentName);
  const department = await Department.create({ factoryId, departmentName });
  return getDepartmentOr404(department.id);
}

async function updateDepartment(id, { factoryId, departmentName }) {
  const department = await getDepartmentOr404(id);
  await assertDepartmentAvailable(factoryId, departmentName, department.id);

  await department.update({ factoryId, departmentName });
  return getDepartmentOr404(id);
}

/** Hard-deletes a department (the model isn't paranoid). Employee.departmentId is ON DELETE RESTRICT, so this fails with a friendly 409 while any employee still references it. */
async function deleteDepartment(id) {
  const department = await getDepartmentOr404(id);
  try {
    await department.destroy();
  } catch (err) {
    if (err.name === "SequelizeForeignKeyConstraintError") {
      throw new ApiError(409, "This department is still assigned to one or more employees and can't be deleted.");
    }
    throw err;
  }
  return department;
}

module.exports = {
  getAllDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
};
