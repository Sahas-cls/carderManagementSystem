"use strict";

// NOTE: despite the filename, this doesn't create a "user_email" table - it
// adds an `email` column to the existing `users` table (the auth system's
// first migration, before login-by-email existed). Kept as-is since renaming
// an already-applied migration file requires updating its recorded name in
// SequelizeMeta to match, or sequelize-cli treats it as a brand new,
// never-run migration and tries to re-apply it.
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("users", "email", {
      type: Sequelize.DataTypes.STRING,
      allowNull: false,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("users", "email");
  },
};
