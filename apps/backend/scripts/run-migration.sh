#!/bin/sh
set -e

if [ -z "${DATABASE_URL}" ]; then
  echo "ERROR: DATABASE_URL is not set" >&2
  exit 1
fi

node_modules/.bin/typeorm migration:run -d dist/database/data-source.js
echo "Migration completed successfully"
