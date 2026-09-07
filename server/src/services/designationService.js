"use strict";

const { Designation } = require("../../models");
const ApiError = require("../utils/ApiError");

/** Returns every designation, ordered by name, for the Manage Designations table and the Resigned Employee popup's dropdown. */
async function getAllDesignations() {
  return Designation.findAll({
    order: [["designation", "ASC"]],
  });
}

async function getDesignationOr404(id) {
  const designation = await Designation.findByPk(id);
  if (!designation) {
    throw new ApiError(404, `Designation ${id} not found.`);
  }
  return designation;
}

/** Rejects a duplicate designation name, excluding `excludeId` on updates. */
async function assertDesignationAvailable(designation, excludeId) {
  const existing = await Designation.findOne({ where: { designation } });
  if (existing && existing.id !== excludeId) {
    throw new ApiError(409, `Designation "${designation}" already exists.`);
  }
}

async function createDesignation({ designation }) {
  await assertDesignationAvailable(designation);
  return Designation.create({ designation });
}

async function updateDesignation(id, { designation }) {
  const row = await getDesignationOr404(id);
  await assertDesignationAvailable(designation, row.id);

  await row.update({ designation });
  return row;
}

/** Hard-deletes a designation (the model isn't paranoid). Employee.designationId is ON DELETE RESTRICT, so this fails with a friendly 409 while any employee still references it. */
async function deleteDesignation(id) {
  const row = await getDesignationOr404(id);
  try {
    await row.destroy();
  } catch (err) {
    if (err.name === "SequelizeForeignKeyConstraintError") {
      throw new ApiError(409, "This designation is still assigned to one or more employees and can't be deleted.");
    }
    throw err;
  }
  return row;
}

module.exports = {
  getAllDesignations,
  createDesignation,
  updateDesignation,
  deleteDesignation,
};
