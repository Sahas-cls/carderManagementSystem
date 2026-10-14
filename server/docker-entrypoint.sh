#!/bin/sh
set -e

echo "Running database migrations..."
npx sequelize-cli db:migrate

exec "$@"
