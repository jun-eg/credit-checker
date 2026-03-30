# デプロイ手順

## 通常デプロイ（自動）

`develop` ブランチへの push → dev 環境へ自動デプロイ
`main` ブランチへの push → prod 環境へ自動デプロイ

## 手動デプロイ

### 前提条件

```bash
# AWS 認証（対象アカウントの認証情報を設定）
aws sts get-caller-identity
```

### インフラのみ再デプロイ

```bash
cd infra
DEV_AWS_ACCOUNT_ID=<account-id> npx cdk deploy --all -c env=dev --require-approval never
```

### アプリのみ再デプロイ（イメージを指定）

```bash
# ECR ログイン
aws ecr get-login-password --region ap-northeast-1 | \
  docker login --username AWS --password-stdin <account-id>.dkr.ecr.ap-northeast-1.amazonaws.com

# ECS Service 更新（最新イメージで再起動）
aws ecs update-service \
  --cluster credit-checker-dev \
  --service credit-checker-frontend \
  --force-new-deployment

aws ecs update-service \
  --cluster credit-checker-dev \
  --service credit-checker-backend \
  --force-new-deployment
```

### migration のみ手動実行

```bash
aws ecs run-task \
  --cluster credit-checker-dev \
  --task-definition credit-checker-migrator-dev \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[<public-subnet-id>],securityGroups=[<fargate-sg-id>],assignPublicIp=ENABLED}"
```
