# Secrets Manager シークレット更新手順

`<app-name>` は `vars.APP_NAME` の値（例: `credit-checker`）、`<env>` は `dev` または `prod`。

## シークレット構造

| パス | 内容 | 生成方法 |
|------|------|----------|
| `/<app-name>/<env>/jwt-secret` | JWT署名キー | CDKデプロイ時に自動生成 |
| `/<app-name>/<env>/auth-secret` | NextAuthキー | CDKデプロイ時に自動生成 |
| `/<app-name>/<env>/app-secrets` | `auth_google_secret`, `openai_api_key` | 初回デプロイ後に手動更新が必要 |
| RDS自動生成シークレット | `username`, `password`, `host`, `port`, `dbname` | RDSが自動生成 |

> `DATABASE_URL` はSecrets Managerに存在しない。RDS認証情報をECSコンテナ起動時のentrypointシェルスクリプトで組み立てる。

## 手動更新（値を変更する）

### `app-secrets`（外部サービス認証情報）

```bash
# シークレット全体を更新
aws secretsmanager update-secret \
  --secret-id "/<app-name>/<env>/app-secrets" \
  --secret-string '{
    "auth_google_secret": "new-value",
    "openai_api_key": "new-value"
  }'
```

### `jwt-secret`（JWT署名キー）

```bash
aws secretsmanager update-secret \
  --secret-id "/<app-name>/<env>/jwt-secret" \
  --secret-string "new-jwt-secret-value"
```

### `auth-secret`（NextAuthキー）

```bash
aws secretsmanager update-secret \
  --secret-id "/<app-name>/<env>/auth-secret" \
  --secret-string "new-auth-secret-value"
```

## 個別キーの更新（jq を使用）

```bash
# 現在の値を取得
CURRENT=$(aws secretsmanager get-secret-value \
  --secret-id "/<app-name>/<env>/app-secrets" \
  --query SecretString --output text)

# auth_google_secret のみ更新
NEW=$(echo "$CURRENT" | jq '.auth_google_secret = "new-value"')

aws secretsmanager update-secret \
  --secret-id "/<app-name>/<env>/app-secrets" \
  --secret-string "$NEW"
```

## 更新後のアプリへの反映

Secrets Manager の値を更新しても、**実行中の ECS タスクは再起動するまで古い値を使い続ける**。
新しい値を反映するには ECS Service を再デプロイする。

```bash
aws ecs update-service \
  --cluster <app-name>-prod \
  --service <app-name>-backend-prod \
  --force-new-deployment

aws ecs update-service \
  --cluster <app-name>-prod \
  --service <app-name>-frontend-prod \
  --force-new-deployment
```

## ローカル開発（secrets/ ファイルの更新）

```bash
echo "new-value" > secrets/jwt_secret
docker compose restart backend
```
