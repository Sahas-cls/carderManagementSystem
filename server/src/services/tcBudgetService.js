"use strict";

const { TCBudget, Factory, User, sequelize } = require("../../models");
const ApiError = require("../utils/ApiError");

const DETAIL_INCLUDE = [
  { model: User, as: "creator", attributes: ["id", "userName"] },
  { model: Factory, as: "factory", attributes: ["id", "factoryCode", "factoryName"] },
];

/** Returns TC budgets, newest first. Scoped to one factory when `factoryId` is given, otherwise every factory. */
async function getTcBudgets(factoryId) {
  return TCBudget.findAll({
    where: factoryId ? { factoryId } : undefined,
    include: DETAIL_INCLUDE,
    order: [["createdAt", "DESC"]],
  });
}

async function getTcBudgetOr404(id) {
  const tcBudget = await TCBudget.findByPk(id, { include: DETAIL_INCLUDE });
  if (!tcBudget) {
    throw new ApiError(404, `Training center budget ${id} not found.`);
  }
  return tcBudget;
}

async function assertFactoryExists(factoryId) {
  const factory = await Factory.findByPk(factoryId);
  if (!factory) {
    throw new ApiError(404, `Factory ${factoryId} not found.`);
  }
}

/** Creates a new TC budget for a factory. New TC budgets start inactive - activate them via setTcBudgetStatus. */
async function createTcBudget({ factoryId, planned }, createdBy) {
  await assertFactoryExists(factoryId);

  const tcBudget = await TCBudget.create({
    factoryId,
    planned,
    status: false,
    createdBy: createdBy ?? null,
  });
  return getTcBudgetOr404(tcBudget.id);
}

/** Updates an existing TC budget's planned count. Factory and status are unaffected. */
async function updateTcBudget(id, { planned }) {
  const tcBudget = await getTcBudgetOr404(id);
  await tcBudget.update({ planned });
  return getTcBudgetOr404(id);
}

/** Soft-deletes a TC budget (the model is paranoid, so this sets deletedAt). */
async function deleteTcBudget(id) {
  const tcBudget = await getTcBudgetOr404(id);
  await tcBudget.destroy();
  return tcBudget;
}

/**
 * Activates/deactivates a TC budget. A factory can only have one active TC budget at a time, so
 * activating one deactivates every other TC budget for the same factory in the same transaction.
 */
async function setTcBudgetStatus(id, status) {
  const tcBudget = await getTcBudgetOr404(id);

  await sequelize.transaction(async (transaction) => {
    if (status) {
      await TCBudget.update(
        { status: false },
        { where: { factoryId: tcBudget.factoryId }, transaction }
      );
    }
    await tcBudget.update({ status: Boolean(status) }, { transaction });
  });

  return getTcBudgetOr404(id);
}

module.exports = { getTcBudgets, createTcBudget, updateTcBudget, deleteTcBudget, setTcBudgetStatus };
