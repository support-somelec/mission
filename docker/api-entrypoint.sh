#!/bin/sh
set -e

echo "==> Applying database migrations..."
cd /app/lib/db
pnpm run push
echo "==> Migrations done."

echo "==> Seeding default data..."
node /app/lib/db/seed.mjs
echo "==> Seed done."

echo "==> Starting API server..."
exec node --enable-source-maps /app/artifacts/api-server/dist/index.mjs
