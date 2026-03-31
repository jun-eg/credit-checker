# ECS Exec でコンテナに入る手順

## 前提条件

- AWS CLI v2
- Session Manager Plugin がインストール済み
- ECS Exec が有効化されたタスク定義（`enableExecuteCommand: true`）

## タスク ARN の確認

```bash
aws ecs list-tasks \
  --cluster credit-checker-dev \
  --service-name credit-checker-backend \
  --query 'taskArns[0]' --output text
```

## コンテナに接続

```bash
TASK_ARN=$(aws ecs list-tasks \
  --cluster credit-checker-dev \
  --service-name credit-checker-backend \
  --query 'taskArns[0]' --output text)

aws ecs execute-command \
  --cluster credit-checker-dev \
  --task "${TASK_ARN}" \
  --container backend \
  --command "/bin/sh" \
  --interactive
```

## よく使うコマンド（コンテナ内）

```sh
# Secret が環境変数として注入されているか確認（ECS secrets: フィールド経由）
echo $DATABASE_URL | head -c 30
printenv | grep -E 'JWT_SECRET|DATABASE_URL|OPENAI_API_KEY'

# DB 接続確認
node -e "const pg=require('pg'); const c=new pg.Client({connectionString:process.env.DATABASE_URL}); c.connect().then(()=>c.query('SELECT NOW()').then(r=>console.log(r.rows)).finally(()=>c.end()))"
```

## 注意

- ECS Exec の有効化には IAM ロールへの `ssmmessages:*` 権限が必要
- prod 環境での接続は監査ログに残るため慎重に使用する
