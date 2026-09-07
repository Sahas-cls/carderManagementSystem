"use strict";

const crypto = require("crypto");
const bcrypt = require("bcryptjs");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Nullable at first so we can safely backfill any pre-existing rows
    // (accounts created before the auth system existed) before locking it
    // down to NOT NULL below.
    await queryInterface.addColumn("users", "password", {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn("users", "isActive", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    const [existingUsers] = await queryInterface.sequelize.query(
      "SELECT id, email FROM users WHERE password IS NULL"
    );
    for (const user of existingUsers) {
      const tempPassword = crypto.randomBytes(9).toString("base64url");
      const hash = await bcrypt.hash(tempPassword, 10);
      await queryInterface.sequelize.query("UPDATE users SET password = ? WHERE id = ?", {
        replacements: [hash, user.id],
      });
      // eslint-disable-next-line no-console
      console.log(
        `[migration] Pre-existing user id=${user.id} (${user.email}) given a temporary password: ${tempPassword} - change it after logging in.`
      );
    }

    await queryInterface.changeColumn("users", "password", {
      type: Sequelize.STRING,
      allowNull: false,
    });

    // Every row that exists at this point in time predates the
    // "self-registration must be activated by an admin" rule - activate
    // them so at least one admin can log in and activate everyone else.
    await queryInterface.sequelize.query("UPDATE users SET isActive = true");

    await queryInterface.addIndex("users", ["email"], {
      unique: true,
      name: "users_email_unique",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex("users", "users_email_unique");
    await queryInterface.removeColumn("users", "isActive");
    await queryInterface.removeColumn("users", "password");
  },
};
