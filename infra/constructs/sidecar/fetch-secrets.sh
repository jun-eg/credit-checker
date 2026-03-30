#!/bin/sh
set -e

fetch_secret() {
  local name=$1
  local secret_id=$2
  aws secretsmanager get-secret-value \
    --secret-id "$secret_id" \
    --query SecretString \
    --output text > "/run/secrets/${name}"
  echo "Fetched: ${name}"
}

# 環境変数 SECRET_<NAME>_ARN が設定されているキーのみ取得する
[ -n "${SECRET_DATABASE_URL_ARN}" ]     && fetch_secret "database_url"       "${SECRET_DATABASE_URL_ARN}"
[ -n "${SECRET_JWT_ARN}" ]              && fetch_secret "jwt_secret"          "${SECRET_JWT_ARN}"
[ -n "${SECRET_AUTH_ARN}" ]             && fetch_secret "auth_secret"         "${SECRET_AUTH_ARN}"
[ -n "${SECRET_GOOGLE_ARN}" ]           && fetch_secret "auth_google_secret"  "${SECRET_GOOGLE_ARN}"
[ -n "${SECRET_OPENAI_ARN}" ]           && fetch_secret "openai_api_key"      "${SECRET_OPENAI_ARN}"

echo "All secrets fetched"
