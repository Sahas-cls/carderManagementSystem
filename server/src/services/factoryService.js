"use strict";

const { Factory, User } = require("../../models");
const ApiError = require("../utils/ApiError");

const CREATOR_INCLUDE = [{ model: User, as: "creator" }];

/** Returns every factory, ordered by name, for use in filter dropdowns etc. */
async function getAllFactories() {
  return Factory.findAll({
    attributes: ["id", "factoryCode", "factoryName", "createdAt", "createdBy"],
    include: CREATOR_INCLUDE,
    order: [["factoryName", "ASC"]],
  });
}

async function getFactoryOr404(id) {
  const factory = await Factory.findByPk(id, { include: CREATOR_INCLUDE });
  if (!factory) {
    throw new ApiError(404, `Factory ${id} not found.`);
  }
  return factory;
}

/** Rejects a duplicate factory code, excluding `excludeId` on updates. */
async function assertCodeAvailable(factoryCode, excludeId) {
  const existing = await Factory.findOne({ where: { factoryCode } });
  if (existing && existing.id !== excludeId) {
    throw new ApiError(409, `Factory code "${factoryCode}" is already in use.`);
  }
}

async function createFactory({ factoryCode, factoryName }, createdBy) {
  await assertCodeAvailable(factoryCode);

  const factory = await Factory.create({ factoryCode, factoryName, createdBy: createdBy ?? null });
  return getFactoryOr404(factory.id);
}

/** Updates an existing factory's code/name. */
async function updateFactory(id, { factoryCode, factoryName }) {
  const factory = await getFactoryOr404(id);
  await assertCodeAvailable(factoryCode, factory.id);

  await factory.update({ factoryCode, factoryName });
  return getFactoryOr404(id);
}

/** Soft-deletes a factory (the model is paranoid, so this sets deletedAt). */
async function deleteFactory(id) {
  const factory = await getFactoryOr404(id);
  // factoryCode is unique at the DB level (see the
  // add-unique-index-to-factory-code migration), which doesn't know about
  // paranoid soft-deletes - free the code up for reuse before deleting, or
  // this factory's old code would be permanently unavailable to anyone else.
  await factory.update({ factoryCode: `${factory.factoryCode}__deleted-${factory.id}` });
  await factory.destroy();
  return factory;
}

module.exports = { getAllFactories, createFactory, updateFactory, deleteFactory };
