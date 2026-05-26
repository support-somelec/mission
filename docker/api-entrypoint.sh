#!/bin/sh
set -e

echo "==> Applying database migrations..."
cd /app/lib/db
node /app/node_modules/.bin/drizzle-kit push --config ./drizzle.config.ts
echo "==> Migrations done."

echo "==> Starting API server..."
cd /app
exec node --enable-source-maps ./dist/index.mjs
