"use strict";
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  // The Transfer tile (see Employee.isTransfer/promotedToMo) derives its
  // "Reason for Transfer" from the Outcome the user picks - Internal
  // Transfer (stays, TMO -> MO) or External Transfer (leaves this carder) -
  // instead of a free pick like Resigned/Terminated uses. Both are just
  // ordinary rows in resignationreasons (editable later via the Manage
  // Resignation Reasons admin page), seeded here so they exist without
  // requiring a manual setup step. Idempotent: only inserts whichever of
  // the two names isn't already present.
  async up(queryInterface) {
    const now = new Date();
    const names = ["Internal Transfer", "External Transfer"];

    const [existing] = await queryInterface.sequelize.query(
      "SELECT resignedReason FROM resignationreasons WHERE resignedReason IN (?, ?)",
      { replacements: names },
    );
    const existingNames = new Set(existing.map((r) => r.resignedReason));

    const rows = names
      .filter((name) => !existingNames.has(name))
      .map((resignedReason) => ({ resignedReason, createdAt: now, updatedAt: now }));

    if (rows.length) {
      await queryInterface.bulkInsert("resignationreasons", rows);
    }
  },
  async down(queryInterface) {
    await queryInterface.bulkDelete("resignationreasons", {
      resignedReason: ["Internal Transfer", "External Transfer"],
    });
  },
};
