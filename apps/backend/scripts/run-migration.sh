#!/bin/sh
set -e
export DATABASE_URL=$(cat /run/secrets/database_url)
node_modules/.bin/typeorm migration:run -d dist/database/data-source.js
echo "Migration completed successfully"
