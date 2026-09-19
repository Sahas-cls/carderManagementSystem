"use strict";
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  // SuperUser: view-only across the app (every factory's Dashboard/Admin data,
  // same 5-year/all-factories scope as Administrator) but can never add, edit
  // or delete anything - enforced both client-side (hidden controls) and
  // server-side (requireRole/forbidRole on the write endpoints).
  async up(queryInterface) {
    const now = new Date();

    const [existing] = await queryInterface.sequelize.query(
      "SELECT userRole FROM userroles WHERE userRole = ?",
      { replacements: ["SuperUser"] },
    );
    if (existing.length) return;

    await queryInterface.bulkInsert("userroles", [
      { userRole: "SuperUser", createdAt: now, updatedAt: now },
    ]);
  },
  async down(queryInterface) {
    await queryInterface.bulkDelete("userroles", { userRole: "SuperUser" });
  },
};
