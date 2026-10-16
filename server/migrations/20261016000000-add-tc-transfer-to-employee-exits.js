"use strict";
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  // Training Center "Transfer to Pro Line" now records each person who left:
  //   prod_mo  - moved to production as MO  (adds to production MO)
  //   prod_tmo - moved to production as TMO (adds to production TMO)
  //   external - transferred out of the company (leaves the TC only)
  // Stored as a new exit type on employeeexits, plus the category, and three
  // resignation reasons so the category reads as the "transfer reason".
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn("employeeexits", "type", {
      type: Sequelize.ENUM("resign", "transfer", "tc_transfer"),
      allowNull: false,
    });
    await queryInterface.addColumn("employeeexits", "tcTransferType", {
      type: Sequelize.ENUM("prod_mo", "prod_tmo", "external"),
      allowNull: true,
    });

    const now = new Date();
    const names = ["To Prod as MO", "To Prod as TMO", "External Transfer"];
    const [existing] = await queryInterface.sequelize.query(
      "SELECT resignedReason FROM resignationreasons WHERE resignedReason IN (?, ?, ?)",
      { replacements: names },
    );
    const have = new Set(existing.map((r) => r.resignedReason));
    const rows = names
      .filter((name) => !have.has(name))
      .map((resignedReason) => ({ resignedReason, transferRelated: true, createdAt: now, updatedAt: now }));
    if (rows.length) await queryInterface.bulkInsert("resignationreasons", rows);
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("employeeexits", "tcTransferType");
    await queryInterface.bulkDelete("employeeexits", { type: "tc_transfer" });
    await queryInterface.changeColumn("employeeexits", "type", {
      type: Sequelize.ENUM("resign", "transfer"),
      allowNull: false,
    });
    await queryInterface.bulkDelete("resignationreasons", { resignedReason: ["To Prod as MO", "To Prod as TMO"] });
  },
};
