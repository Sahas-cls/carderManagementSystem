"use strict";
/**
 * Wraps config.json so Docker/production can supply the database through the
 * DB_* env vars docker-compose sets. With DB_HOST unset this is exactly
 * config.json, so local development is unchanged. Used by both the app
 * (models/index.js) and sequelize-cli (.sequelizerc).
 */
const base = require("./config.json");

const fromEnv = () =>
  process.env.DB_HOST
    ? {
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT) || 3306,
        username: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
      }
    : {};

module.exports = Object.fromEntries(
  Object.entries(base).map(([env, cfg]) => [env, { ...cfg, ...fromEnv() }]),
);
