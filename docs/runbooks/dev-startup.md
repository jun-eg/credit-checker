# Dev 環境の手動起動手順

夜間停止（JST 0:00）後に dev 環境を手動で起動する手順。

## GitHub Actions から起動

リポジトリの Actions タブ → 「Dev Environment Shutdown」ワークフローを参考に、
起動用ワークフローを手動トリガーする（別途 `dev-startup.yml` を作成する場合）。

## AWS CLI から起動

```bash
# AWS 認証（dev アカウント）
export AWS_PROFILE=credit-checker-dev  # または適切なプロファイル名

# Frontend を起動（minCapacity:0 → 1 に変更）
aws ecs update-service \
  --cluster credit-checker-dev \
  --service credit-checker-frontend \
  --desired-count 1 \
  --region ap-northeast-1

# Backend を起動
aws ecs update-service \
  --cluster credit-checker-dev \
  --service credit-checker-backend \
  --desired-count 1 \
  --region ap-northeast-1

# 起動完了待機
aws ecs wait services-stable \
  --cluster credit-checker-dev \
  --services credit-checker-frontend credit-checker-backend \
  --region ap-northeast-1

echo "Dev environment is ready: https://dev.jun-eg.site"
```

## 確認

```bash
# サービス状態の確認
aws ecs describe-services \
  --cluster credit-checker-dev \
  --services credit-checker-frontend credit-checker-backend \
  --query 'services[*].{name:serviceName,running:runningCount,desired:desiredCount}'
```
