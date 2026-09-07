"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // List all tables with EXACT names as they exist in your database
    const tables = [
      "newrecruitcarders",
      "resignedcarders",
      "netcarders",
      "absenteeismcarders",
    ];

    try {
      // Check which tables exist - different way to query
      const [results, metadata] = await queryInterface.sequelize.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name IN (?)",
        { replacements: [tables] },
      );

      // results should be an array
      const existingTables = Array.isArray(results)
        ? results.map((row) => row.table_name)
        : [];

      // Add date column only to existing tables
      for (const table of tables) {
        if (existingTables.includes(table)) {
          try {
            await queryInterface.addColumn(table, "date", {
              type: Sequelize.DATEONLY,
              allowNull: true,
            });
            console.log(`✅ Added date column to ${table}`);
          } catch (error) {
            console.log(
              `❌ Error adding date column to ${table}: ${error.message}`,
            );
          }
        } else {
          console.log(`⚠️ Table ${table} doesn't exist, skipping...`);
        }
      }
    } catch (error) {
      console.log("Error checking tables:", error.message);
      // Fallback: Try to add column to each table individually
      for (const table of tables) {
        try {
          await queryInterface.addColumn(table, "date", {
            type: Sequelize.DATEONLY,
            allowNull: true,
          });
          console.log(`✅ Added date column to ${table}`);
        } catch (err) {
          console.log(
            `❌ Could not add date column to ${table}: ${err.message}`,
          );
        }
      }
    }
  },

  async down(queryInterface, Sequelize) {
    const tables = [
      "newrecruitcarders",
      "resignedcarders",
      "netcarders",
      "absenteeismcarders",
    ];

    try {
      const [results, metadata] = await queryInterface.sequelize.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name IN (?)",
        { replacements: [tables] },
      );

      const existingTables = Array.isArray(results)
        ? results.map((row) => row.table_name)
        : [];

      for (const table of tables) {
        if (existingTables.includes(table)) {
          try {
            await queryInterface.removeColumn(table, "date");
            console.log(`✅ Removed date column from ${table}`);
          } catch (error) {
            console.log(
              `❌ Error removing date column from ${table}: ${error.message}`,
            );
          }
        }
      }
    } catch (error) {
      console.log("Error checking tables:", error.message);
      // Fallback: Try to remove column from each table
      for (const table of tables) {
        try {
          await queryInterface.removeColumn(table, "date");
          console.log(`✅ Removed date column from ${table}`);
        } catch (err) {
          console.log(
            `❌ Could not remove date column from ${table}: ${err.message}`,
          );
        }
      }
    }
  },
};
