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
# secret が正しくマウントされているか確認
ls /run/secrets/
cat /run/secrets/database_url | head -c 30

# DB 接続確認
node -e "const pg=require('pg'); const c=new pg.Client({connectionString:require('fs').readFileSync('/run/secrets/database_url','utf8').trim()}); c.connect().then(()=>c.query('SELECT NOW()').then(r=>console.log(r.rows)).finally(()=>c.end()))"
```

## 注意

- ECS Exec の有効化には IAM ロールへの `ssmmessages:*` 権限が必要
- prod 環境での接続は監査ログに残るため慎重に使用する
