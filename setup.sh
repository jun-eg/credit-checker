#!/bin/bash
# ローカル開発用セットアップスクリプト
# .env の値を読み取り、docker compose が必要とする secrets/ ファイルを生成する

set -euo pipefail

ENV_FILE=".env"
SECRETS_DIR="./secrets"

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: $ENV_FILE が見つかりません。cp .env.example .env を実行してから値を設定してください。" >&2
  exit 1
fi

# .env を読み込む（export しないと他のコマンドに漏れないため安全）
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

# 外部サービス依存の値が未設定の場合は中断
MISSING=()
[ -z "${AUTH_GOOGLE_SECRET:-}" ] && MISSING+=("AUTH_GOOGLE_SECRET")
[ -z "${OPENAI_API_KEY:-}" ]     && MISSING+=("OPENAI_API_KEY")

if [ ${#MISSING[@]} -gt 0 ]; then
  echo "ERROR: .env に以下の値が設定されていません（外部サービスから取得してください）:" >&2
  for key in "${MISSING[@]}"; do
    echo "  - $key" >&2
  done
  exit 1
fi

mkdir -p "$SECRETS_DIR"

# JWT_SECRET / AUTH_SECRET は未設定なら自動生成
if [ -z "${JWT_SECRET:-}" ]; then
  JWT_SECRET=$(openssl rand -hex 32)
  echo "INFO: JWT_SECRET を自動生成しました。"
fi

if [ -z "${AUTH_SECRET:-}" ]; then
  AUTH_SECRET=$(openssl rand -hex 32)
  echo "INFO: AUTH_SECRET を自動生成しました。"
fi

# DATABASE_URL は POSTGRES_* から組み立て（docker compose 内部ネットワーク向け）
DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}"

# secrets/ ファイルを生成（末尾改行なし）
printf "%s" "$JWT_SECRET"         > "$SECRETS_DIR/jwt_secret"
printf "%s" "$AUTH_SECRET"        > "$SECRETS_DIR/auth_secret"
printf "%s" "$AUTH_GOOGLE_SECRET" > "$SECRETS_DIR/auth_google_secret"
printf "%s" "$OPENAI_API_KEY"     > "$SECRETS_DIR/openai_api_key"
printf "%s" "$DATABASE_URL"       > "$SECRETS_DIR/database_url"

echo "secrets/ ファイルを生成しました。docker compose up で起動できます。"
