"use strict";

const { ResignationReason } = require("../../models");
const ApiError = require("../utils/ApiError");

/**
 * Returns resignation reasons, ordered by name, for the Reason Master table
 * and Employee's resignation/transfer dropdowns. `transferRelated`
 * (true/false) narrows to just that flag - omit it for every reason (the
 * Reason Master table's own listing).
 */
async function getAllResignationReasons({ transferRelated } = {}) {
  const where = {};
  if (transferRelated !== undefined) where.transferRelated = transferRelated;
  return ResignationReason.findAll({
    where,
    order: [["resignedReason", "ASC"]],
  });
}

async function getReasonOr404(id) {
  const reason = await ResignationReason.findByPk(id);
  if (!reason) {
    throw new ApiError(404, `Resignation reason ${id} not found.`);
  }
  return reason;
}

/** Rejects a duplicate reason name, excluding `excludeId` on updates. */
async function assertReasonAvailable(resignedReason, excludeId) {
  const existing = await ResignationReason.findOne({ where: { resignedReason } });
  if (existing && existing.id !== excludeId) {
    throw new ApiError(409, `Resignation reason "${resignedReason}" already exists.`);
  }
}

async function createResignationReason({ resignedReason, transferRelated }) {
  await assertReasonAvailable(resignedReason);
  return ResignationReason.create({ resignedReason, transferRelated: !!transferRelated });
}

async function updateResignationReason(id, { resignedReason, transferRelated }) {
  const reason = await getReasonOr404(id);
  await assertReasonAvailable(resignedReason, reason.id);

  await reason.update({ resignedReason, transferRelated: !!transferRelated });
  return reason;
}

/** Hard-deletes a resignation reason (the model isn't paranoid). Any employee referencing it keeps its
 * record with resignationReasonId set to NULL - see the FK's ON DELETE SET NULL. */
async function deleteResignationReason(id) {
  const reason = await getReasonOr404(id);
  await reason.destroy();
  return reason;
}

module.exports = {
  getAllResignationReasons,
  createResignationReason,
  updateResignationReason,
  deleteResignationReason,
};
