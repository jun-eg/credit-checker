# Rollback 手順

## アプリ Rollback（タスク定義を前リビジョンに戻す）

```bash
# 現在のリビジョンを確認
aws ecs describe-services \
  --cluster credit-checker-prod \
  --services credit-checker-frontend-prod credit-checker-backend-prod \
  --query 'services[*].{name:serviceName,taskDef:taskDefinition}'

# 1つ前のリビジョンに戻す（例: revision 5 → 4）
aws ecs update-service \
  --cluster credit-checker-prod \
  --service credit-checker-frontend-prod \
  --task-definition credit-checker-frontend-prod:4

aws ecs update-service \
  --cluster credit-checker-prod \
  --service credit-checker-backend-prod \
  --task-definition credit-checker-backend-prod:4

# 安定待機
aws ecs wait services-stable \
  --cluster credit-checker-prod \
  --services credit-checker-frontend-prod credit-checker-backend-prod
```

## インフラ Rollback（CDK）

CDK は CloudFormation Stack をデプロイしているため、Stack 単位で前のテンプレートに戻す。

```bash
# CloudFormation コンソールから対象 Stack を選択 → 「スタックの操作」→「ドリフトの検出」で差分を確認

# または特定の変更セットに戻す
aws cloudformation list-change-sets --stack-name ProdApp

# 緊急時はインフラの手動ロールバックも可能（コンソールで操作）
```

## DB Rollback

migration のダウングレードが必要な場合:

```bash
# migration task で revert を実行（Dockerfile に revert target を追加する必要あり）
# DATABASE_URL はタスク定義の secrets: フィールドで注入済みのため、コマンドのみ上書きする
aws ecs run-task \
  --cluster credit-checker-prod \
  --task-definition credit-checker-migrator-prod \
  --launch-type FARGATE \
  --overrides '{"containerOverrides":[{"name":"migrator","command":["node_modules/.bin/typeorm","migration:revert","-d","dist/database/data-source.js"]}]}' \
  --network-configuration "awsvpcConfiguration={subnets=[<public-subnet-id>],securityGroups=[<fargate-sg-id>],assignPublicIp=ENABLED}"
```
