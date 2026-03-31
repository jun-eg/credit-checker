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

`appName` は CDK context の実行時引数 `-c appName=<app-name>` で渡す。GitHub Actions では `vars.APP_NAME` で管理。

```bash
cd infra
DEV_AWS_ACCOUNT_ID=<account-id> npx cdk deploy --all -c env=dev -c appName=<app-name> --require-approval never
```

### アプリのみ再デプロイ（タスク定義変更なし）

`<app-name>` は `vars.APP_NAME` の値（例: `credit-checker`）を使用。

現在登録済みのタスク定義のまま強制再デプロイする（Secret更新後の再起動など）。
CI/CD 自動フローでは新しいタスク定義ARNを `--task-definition` で指定するため、このコマンドとは異なる。

```bash
# ECR ログイン
aws ecr get-login-password --region ap-northeast-1 | \
  docker login --username AWS --password-stdin <account-id>.dkr.ecr.ap-northeast-1.amazonaws.com

# ECS Service 更新（タスク定義変更なし・現在の設定で強制再デプロイ）
aws ecs update-service \
  --cluster <app-name>-dev \
  --service <app-name>-frontend-dev \
  --force-new-deployment

aws ecs update-service \
  --cluster <app-name>-dev \
  --service <app-name>-backend-dev \
  --force-new-deployment
```

### migration のみ手動実行

```bash
aws ecs run-task \
  --cluster <app-name>-dev \
  --task-definition <app-name>-migrator-dev \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[<public-subnet-id>],securityGroups=[<fargate-sg-id>],assignPublicIp=ENABLED}"
```
