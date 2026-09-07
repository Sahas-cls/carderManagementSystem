"use strict";

const { Section } = require("../../models");
const ApiError = require("../utils/ApiError");

/** Returns every section, ordered by name, for the Manage Sections table and the Resigned Employee popup's dropdown. */
async function getAllSections() {
  return Section.findAll({
    order: [["sectionName", "ASC"]],
  });
}

async function getSectionOr404(id) {
  const section = await Section.findByPk(id);
  if (!section) {
    throw new ApiError(404, `Section ${id} not found.`);
  }
  return section;
}

/** Rejects a duplicate section name, excluding `excludeId` on updates. */
async function assertSectionAvailable(sectionName, excludeId) {
  const existing = await Section.findOne({ where: { sectionName } });
  if (existing && existing.id !== excludeId) {
    throw new ApiError(409, `Section "${sectionName}" already exists.`);
  }
}

async function createSection({ sectionName }) {
  await assertSectionAvailable(sectionName);
  return Section.create({ sectionName });
}

async function updateSection(id, { sectionName }) {
  const row = await getSectionOr404(id);
  await assertSectionAvailable(sectionName, row.id);

  await row.update({ sectionName });
  return row;
}

/** Hard-deletes a section (the model isn't paranoid). Employee.sectionId is ON DELETE RESTRICT, so this fails with a friendly 409 while any employee still references it. */
async function deleteSection(id) {
  const row = await getSectionOr404(id);
  try {
    await row.destroy();
  } catch (err) {
    if (err.name === "SequelizeForeignKeyConstraintError") {
      throw new ApiError(409, "This section is still assigned to one or more employees and can't be deleted.");
    }
    throw err;
  }
  return row;
}

module.exports = {
  getAllSections,
  createSection,
  updateSection,
  deleteSection,
};
