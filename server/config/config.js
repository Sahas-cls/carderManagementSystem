'use strict';

require('dotenv').config();

const common = {
  username: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || null,
  host: process.env.DB_HOST || '127.0.0.1',
  port: process.env.DB_PORT || 3306,
  dialect: 'mysql',
};

module.exports = {
  development: {
    ...common,
    database: process.env.DB_NAME || 'carder_management_sys',
  },
  test: {
    ...common,
    database: process.env.DB_NAME || 'database_test',
  },
  production: {
    ...common,
    database: process.env.DB_NAME || 'database_production',
  },
};
