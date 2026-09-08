"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // factoryCode has always been treated as unique app-side
    // (factoryService.assertCodeAvailable) but never enforced at the DB
    // level - nothing stopped a race (or a direct DB write) from creating
    // two factories with the same code. A handful of already soft-deleted
    // rows (old test/duplicate factories) share a blank "" code or collide
    // with a still-active one ("GLL" exists on both an active row and an
    // old deleted duplicate) - mangle those so the unique index below can
    // actually be added. This mirrors what factoryService.deleteFactory now
    // does on every future delete, so a deleted factory's code is freed up
    // for reuse instead of permanently blocking it.
    await queryInterface.sequelize.query(`
      UPDATE factories
      SET factoryCode = CONCAT(factoryCode, '__deleted-', id)
      WHERE deletedAt IS NOT NULL
    `);

    await queryInterface.addIndex("factories", ["factoryCode"], {
      unique: true,
      name: "factories_factory_code_unique",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex("factories", "factories_factory_code_unique");
    // Not un-mangling the old soft-deleted rows' codes - that rewrite was
    // one-way by design (see up()); their original codes aren't relied on
    // anywhere the app still reads paranoid-deleted rows.
  },
};
