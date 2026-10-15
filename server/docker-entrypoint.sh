#!/bin/sh
set -e

echo "Configuring Sequelize for Docker..."

node <<'NODE'
const fs = require('fs');

const configPath = '/app/config/config.json';
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

config.production = {
  ...config.production,
  host: process.env.DB_HOST || 'mysql',
  port: Number(process.env.DB_PORT || 3306),
  database: process.env.DB_NAME || 'carder_management_sys',
  username: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || '',
};

delete config.production.use_env_variable;

fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
console.log('Sequelize production configuration updated.');
NODE

echo "Skipping automatic database migrations..."

echo "Starting backend..."
exec "$@"

