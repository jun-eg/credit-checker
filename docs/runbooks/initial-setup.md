# 初回セットアップ手順

初回デプロイ時のみ必要な手順。2回目以降のデプロイでは不要。

## ローカル開発環境

```bash
cp .env.example .env
```

`.env` を編集し、以下の2つを外部サービスから取得して設定する：

| 変数 | 取得元 |
|------|--------|
| `AUTH_GOOGLE_SECRET` | Google Cloud Console → 認証情報 → OAuth 2.0 クライアント |
| `OPENAI_API_KEY` | OpenAI Platform → API keys |

`JWT_SECRET` / `AUTH_SECRET` はローカルでは固定のダミー値で動作するため変更不要。

```bash
./setup.sh
docker compose up
```

---

## AWS 環境（dev / prod）

### 1. CDK deploy

```bash
cd infra
npx cdk deploy NetworkStack-dev DataStack-dev AppStack-dev EdgeStack-dev
```

### 2. Secrets Manager を更新する

**この手順は ECS サービス起動前に必ず実施すること。**
`REPLACE_ME` のままでは起動後にアプリが正常動作しない。

CDK deploy により以下が自動生成済み（手動設定不要）：
- `/<app-name>/<env>/jwt-secret` — CDK が自動生成
- `/<app-name>/<env>/auth-secret` — CDK が自動生成
- RDS 認証情報（username / password / host）— RDS が自動生成。ECS には個別フィールドとして注入され、コンテナ起動時に DATABASE_URL を組み立てる

手動設定が必要なのは `app-secrets` の2フィールドのみ：

```bash
aws secretsmanager update-secret \
  --secret-id "/<app-name>/<env>/app-secrets" \
  --secret-string '{
    "auth_google_secret": "<Google Cloud Console から取得>",
    "openai_api_key":     "<OpenAI から取得>"
  }' \
  --region ap-northeast-1
```

`<app-name>` は `APP_NAME`（例: `credit-checker`）、`<env>` は `dev` または `prod`。

設定内容を確認する：

```bash
aws secretsmanager get-secret-value \
  --secret-id "/<app-name>/<env>/app-secrets" \
  --query SecretString --output text | jq .
```

### 3. ECS タスクを再起動して反映

```bash
aws ecs update-service \
  --cluster <app-name>-<env> \
  --service <app-name>-backend-<env> \
  --force-new-deployment \
  --region ap-northeast-1

aws ecs update-service \
  --cluster <app-name>-<env> \
  --service <app-name>-frontend-<env> \
  --force-new-deployment \
  --region ap-northeast-1
```

---

## 2回目以降のシークレット更新

値を変更したい場合は `docs/runbooks/secret-rotation.md` を参照。
