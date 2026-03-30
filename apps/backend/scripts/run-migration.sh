#!/bin/sh
set -e

# ECS secrets フィールド（環境変数注入）を優先し、
# ローカル（docker compose secrets ファイル）をフォールバックとする
if [ -z "${DATABASE_URL}" ]; then
  SECRET_FILE="/run/secrets/database_url"
  if [ -f "${SECRET_FILE}" ]; then
    export DATABASE_URL=$(cat "${SECRET_FILE}")
  else
    echo "ERROR: DATABASE_URL is not set and ${SECRET_FILE} does not exist" >&2
    exit 1
  fi
fi

node_modules/.bin/typeorm migration:run -d dist/database/data-source.js
echo "Migration completed successfully"
