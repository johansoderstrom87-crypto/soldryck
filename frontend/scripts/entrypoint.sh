#!/bin/sh
# Container entrypoint:
# 1. Ensure mounted volume is writable by nextjs user
# 2. Run seed (downloads shadow-data on first boot)
# 3. Start Next.js as non-root nextjs user
set -e

mkdir -p "${SHADOW_DATA_PATH:-/app/shadow-data}"
chown -R nextjs:nodejs "${SHADOW_DATA_PATH:-/app/shadow-data}"

exec su-exec nextjs:nodejs sh -c "node scripts/seed-shadow-data.mjs && node server.js"
