"use strict";

const { Week } = require("../../models");
const ApiError = require("../utils/ApiError");

/** Returns every week, oldest first, for use in filter dropdowns etc. */
async function getAllWeeks() {
  return Week.findAll({
    attributes: ["id", "week"],
    order: [["week", "ASC"]],
  });
}

/** Creates a new week. Rejects a duplicate date so the filter dropdown never gets two entries for the same week. */
async function createWeek({ week }, createdBy) {
  const existing = await Week.findOne({ where: { week } });
  if (existing) {
    throw new ApiError(409, `A week for ${week} already exists.`);
  }
  return Week.create({ week, createdBy: createdBy ?? null });
}

/** Updates an existing week's date. */
async function updateWeek(id, { week }) {
  const record = await Week.findByPk(id);
  if (!record) {
    throw new ApiError(404, `Week ${id} not found.`);
  }
  const duplicate = await Week.findOne({ where: { week } });
  if (duplicate && duplicate.id !== record.id) {
    throw new ApiError(409, `A week for ${week} already exists.`);
  }
  await record.update({ week });
  return record;
}

module.exports = { getAllWeeks, createWeek, updateWeek };
