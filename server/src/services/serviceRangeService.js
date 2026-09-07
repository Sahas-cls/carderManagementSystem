"use strict";

const { ManageServiceRanges } = require("../../models");
const ApiError = require("../utils/ApiError");

/** Returns every service range, ordered by duration, for the Service Range Master table. */
async function getAllServiceRanges() {
  return ManageServiceRanges.findAll({
    order: [
      ["years", "ASC"],
      ["months", "ASC"],
    ],
  });
}

async function getServiceRangeOr404(id) {
  const range = await ManageServiceRanges.findByPk(id);
  if (!range) {
    throw new ApiError(404, `Service range ${id} not found.`);
  }
  return range;
}

/** Rejects a duplicate years/months combination, excluding `excludeId` on updates. */
async function assertRangeAvailable(years, months, excludeId) {
  const existing = await ManageServiceRanges.findOne({ where: { years, months } });
  if (existing && existing.id !== excludeId) {
    throw new ApiError(409, `A service range of ${years} years ${months} months already exists.`);
  }
}

async function createServiceRange({ years, months }) {
  await assertRangeAvailable(years, months);
  return ManageServiceRanges.create({ years, months });
}

async function updateServiceRange(id, { years, months }) {
  const range = await getServiceRangeOr404(id);
  await assertRangeAvailable(years, months, range.id);

  await range.update({ years, months });
  return range;
}

/** Soft-deletes a service range (the model is paranoid, so this sets deletedAt). */
async function deleteServiceRange(id) {
  const range = await getServiceRangeOr404(id);
  await range.destroy();
  return range;
}

module.exports = {
  getAllServiceRanges,
  createServiceRange,
  updateServiceRange,
  deleteServiceRange,
};
