# Dev 環境の手動起動手順

## ローカル開発環境の初回セットアップ

```bash
cp .env.example .env
# .env を編集: AUTH_GOOGLE_SECRET と OPENAI_API_KEY を外部サービスから取得して設定
npm run dev
```

`npm run dev` は初回に `setup.sh` を自動実行して `secrets/` ファイルを生成してから起動する。
2回目以降は既存の `secrets/` をスキップしてそのまま起動する。
`DATABASE_URL` は `POSTGRES_*` 変数から自動組み立てするため `.env` への記載は不要。

---

夜間停止（JST 0:00）後に dev 環境を手動で起動する手順。

## GitHub Actions から起動

リポジトリの Actions タブ → 「Dev Environment Startup」ワークフロー → 「Run workflow」で手動トリガーする。

## AWS CLI から起動

```bash
# AWS 認証（dev アカウント）
export AWS_PROFILE=<app-name>-dev  # または適切なプロファイル名

# Frontend を起動（minCapacity:0 → 1 に変更）
aws ecs update-service \
  --cluster <app-name>-dev \
  --service <app-name>-frontend-dev \
  --desired-count 1 \
  --region ap-northeast-1

# Backend を起動
aws ecs update-service \
  --cluster <app-name>-dev \
  --service <app-name>-backend-dev \
  --desired-count 1 \
  --region ap-northeast-1

# 起動完了待機
aws ecs wait services-stable \
  --cluster <app-name>-dev \
  --services <app-name>-frontend-dev <app-name>-backend-dev \
  --region ap-northeast-1

echo "Dev environment is ready: https://dev.${DEV_DOMAIN}"
```

## 確認

```bash
# サービス状態の確認
aws ecs describe-services \
  --cluster <app-name>-dev \
  --services <app-name>-frontend-dev <app-name>-backend-dev \
  --query 'services[*].{name:serviceName,running:runningCount,desired:desiredCount}'
```
