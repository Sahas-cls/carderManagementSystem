"use strict";

const { Budget, Factory, User, sequelize } = require("../../models");
const ApiError = require("../utils/ApiError");

const DETAIL_INCLUDE = [
  { model: User, as: "creator", attributes: ["id", "userName"] },
  { model: Factory, as: "factory", attributes: ["id", "factoryCode", "factoryName"] },
];

/** Returns budgets, newest first. Scoped to one factory when `factoryId` is given, otherwise every factory. */
async function getBudgets(factoryId) {
  return Budget.findAll({
    where: factoryId ? { factoryId } : undefined,
    include: DETAIL_INCLUDE,
    order: [["createdAt", "DESC"]],
  });
}

async function getBudgetOr404(id) {
  const budget = await Budget.findByPk(id, { include: DETAIL_INCLUDE });
  if (!budget) {
    throw new ApiError(404, `Budget ${id} not found.`);
  }
  return budget;
}

async function assertFactoryExists(factoryId) {
  const factory = await Factory.findByPk(factoryId);
  if (!factory) {
    throw new ApiError(404, `Factory ${factoryId} not found.`);
  }
}

/** Creates a new budget for a factory. New budgets start inactive - activate them via setBudgetStatus. */
async function createBudget({ factoryId, moCount, tmoCount }, createdBy) {
  await assertFactoryExists(factoryId);

  const budget = await Budget.create({
    factoryId,
    moCount,
    tmoCount,
    total: moCount + tmoCount,
    status: false,
    createdBy: createdBy ?? null,
  });
  return getBudgetOr404(budget.id);
}

/** Updates an existing budget's MO/TMO counts (and recomputed total). Factory and status are unaffected. */
async function updateBudget(id, { moCount, tmoCount }) {
  const budget = await getBudgetOr404(id);
  await budget.update({ moCount, tmoCount, total: moCount + tmoCount });
  return getBudgetOr404(id);
}

/** Soft-deletes a budget (the model is paranoid, so this sets deletedAt). */
async function deleteBudget(id) {
  const budget = await getBudgetOr404(id);
  await budget.destroy();
  return budget;
}

/**
 * Activates/deactivates a budget. A factory can only have one active budget at a time, so
 * activating one deactivates every other budget for the same factory in the same transaction.
 */
async function setBudgetStatus(id, status) {
  const budget = await getBudgetOr404(id);

  await sequelize.transaction(async (transaction) => {
    if (status) {
      await Budget.update(
        { status: false },
        { where: { factoryId: budget.factoryId }, transaction }
      );
    }
    await budget.update({ status: Boolean(status) }, { transaction });
  });

  return getBudgetOr404(id);
}

module.exports = { getBudgets, createBudget, updateBudget, deleteBudget, setBudgetStatus };
