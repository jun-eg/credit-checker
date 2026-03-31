# Secrets Manager シークレット更新手順

## 手動更新（値を変更する）

`<app-name>` は `vars.APP_NAME` の値（例: `credit-checker`）、`<env>` は `dev` または `prod`。

```bash
# シークレット全体を更新
aws secretsmanager update-secret \
  --secret-id "/<app-name>/<env>/app-secrets" \
  --secret-string '{
    "jwt_secret": "new-jwt-secret-value",
    "auth_secret": "new-auth-secret-value",
    "auth_google_secret": "existing-value",
    "openai_api_key": "existing-value",
    "database_url": "existing-value"
  }'
```

## 個別キーの更新（jq を使用）

```bash
# 現在の値を取得
CURRENT=$(aws secretsmanager get-secret-value \
  --secret-id "/<app-name>/<env>/app-secrets" \
  --query SecretString --output text)

# jwt_secret のみ更新
NEW=$(echo "$CURRENT" | jq '.jwt_secret = "new-value"')

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
