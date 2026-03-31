# Issue #115 実装計画：latestタグ運用をSHAタグに移行しロールバックの確実性を担保する

## 背景・問題

### なぜlatestタグではロールバックが機能しないか

現在のロールバック処理は「前のタスク定義リビジョン番号」を指定してサービスを更新している。

```bash
# reusable-app-deploy.yml 現在のロールバック
aws ecs update-service \
  --task-definition credit-checker-frontend-dev:${PREV_REVISION}
```

しかし**タスク定義のimageフィールドは `latest` タグへの参照文字列**であり、ECSは起動時に `latest` タグが指すイメージをECRから取得する。

```
タスク定義リビジョン5（CDK管理）: image = ".../frontend:latest"  ← 常に最新を指す
タスク定義リビジョン6（CDK管理）: image = ".../frontend:latest"  ← 同上
```

リビジョン5に戻しても、`latest` タグはデプロイ後のイメージを指し続けているため、実際には前のコードには戻らない。

### 副次的な問題

`reusable-app-deploy.yml` の migration run-task で `containerOverrides.image` を指定しているが、ECS の `containerOverrides` は `image` の上書きをサポートしていない（command / environment / cpu / memory等のみ対応）。このフィールドは無視され、意図と動作が乖離している。

## 修正方針

**SHAタグ + `register-task-definition` 方式**に移行する。

### 新しいデプロイフロー

```
① ECRにSHAタグのみでpush（latestタグは廃止）
② describe-task-definition で現在のCDK管理タスク定義を取得
③ imageをSHAタグURIに書き換えたJSONで register-task-definition（3つ：frontend/backend/migrator）
④ 登録したmigratorのARNでrun-task（overridesのimageフィールドは不要）
⑤ 登録したfrontend/backendのARNでupdate-service
⑥ services-stable 待機
⑦ 失敗時 → 登録前のARN（保存済み）でupdate-service（確実に前のイメージに戻る）
```

### ロールバックが機能する理由

```
タスク定義リビジョンA（CDK管理）: image = ".../frontend:latest"（プレースホルダー）
タスク定義リビジョンB（CI登録）:  image = ".../frontend:abc1234"（コミットSHA）← 今回デプロイ
タスク定義リビジョンC（CI登録）:  image = ".../frontend:def5678"（前回デプロイ）← ロールバック先
```

ロールバック時はリビジョンCのARNを指定するだけで、前のコミットのイメージが確実に動く。

---

## 変更対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `.github/workflows/reusable-app-deploy.yml` | メインの変更（後述） |
| `infra/lib/app/app-stack.ts` | CDKタスク定義のimageをプレースホルダーに変更 |
| `infra/lib/app/app-stack.ts`（IAM） | github-actions-deploy-roleへのecs権限追加 |

---

## 詳細実装

### 1. `infra/lib/app/app-stack.ts`

#### 1-1. CDKタスク定義のimageをプレースホルダーに変更

CDKはタスク定義の「型」（CPU / メモリ / IAM / 環境変数 / シークレット設定）を管理し、imageはCIが登録するリビジョンで管理する。初回CDKデプロイ時のみlatestが使われ、以降はCIが登録したリビジョンが使われる。

```typescript
// 変更前
frontendTask.addContainer('frontend', {
  image: ecs.ContainerImage.fromEcrRepository(frontendRepo, 'latest'),
  ...
});

// 変更後：CDKはlatestを保持（初回deploy用プレースホルダー）
// 実運用ではCIが毎デプロイ時にSHAタグのリビジョンを登録して上書きする
// （コメントで意図を明示する）
frontendTask.addContainer('frontend', {
  // CI（reusable-app-deploy.yml）がデプロイ時にSHAタグで register-task-definition を実行する。
  // このlatestはCDK初回デプロイ時のプレースホルダーであり、実運用では使われない。
  image: ecs.ContainerImage.fromEcrRepository(frontendRepo, 'latest'),
  ...
});
```

> **NOTE:** CDKのapp-stack.tsのimage指定自体は変更不要。変更はコメント追加と、IAM権限追加のみ。

#### 1-2. github-actions-deploy-roleへのECS権限追加

GitHubActionsのOIDCロールに `register-task-definition` と `describe-task-definition` の権限が必要。

現在 `taskExecutionRole` のポリシーで `secretsmanager:GetSecretValue` を付与している箇所に倣い、`AppStack` コンストラクタ内でデプロイロールへの権限付与を追加する。

ただし、`github-actions-deploy-role` はCDKの外（IAMコンソール or 別スタック）で管理されている可能性がある。その場合はAWSコンソールで手動追加する。

追加が必要なIAMアクション：
```
ecs:RegisterTaskDefinition
ecs:DescribeTaskDefinition
iam:PassRole  （新しいタスク定義にexecutionRoleを渡すため。既存の場合は不要）
```

---

### 2. `.github/workflows/reusable-app-deploy.yml`

#### 2-1. Build and push（latestタグを廃止）

```yaml
- name: Build and push frontend
  uses: docker/build-push-action@v5
  with:
    context: .
    file: apps/frontend/Dockerfile
    push: true
    tags: |
      ${{ secrets.aws_account_id }}.dkr.ecr.${{ vars.AWS_REGION }}.amazonaws.com/${{ vars.APP_NAME }}-frontend:${{ steps.meta.outputs.tag }}
      # latestタグは廃止（SHAタグのみ）
```

backend / backend-migrator も同様にlatestタグを削除する。

#### 2-2. Register task definitions ステップを新規追加

Build and pushの直後、"Record deploy metadata" の前に挿入する。

```yaml
- name: Register task definitions with SHA tag
  id: register_tasks
  run: |
    ECR_BASE="${{ secrets.aws_account_id }}.dkr.ecr.${{ vars.AWS_REGION }}.amazonaws.com"
    SHA="${{ steps.meta.outputs.tag }}"
    APP="${{ vars.APP_NAME }}"
    ENV="${{ inputs.environment }}"

    register_task_def() {
      local FAMILY="$1"
      local IMAGE_URI="$2"

      # 現在のCDK管理タスク定義を取得（CDKが持つ環境変数・シークレット設定を引き継ぐ）
      TASK_DEF=$(aws ecs describe-task-definition \
        --task-definition "${FAMILY}" \
        --query 'taskDefinition' \
        --output json | jq 'del(
          .taskDefinitionArn,
          .revision,
          .status,
          .requiresAttributes,
          .placementConstraints,
          .compatibilities,
          .registeredAt,
          .registeredBy
        )')

      # imageをSHAタグURIに書き換え
      NEW_DEF=$(echo "$TASK_DEF" | jq \
        --arg IMAGE "$IMAGE_URI" \
        '.containerDefinitions[0].image = $IMAGE')

      # 新しいリビジョンを登録してARNを返す
      aws ecs register-task-definition \
        --cli-input-json "$NEW_DEF" \
        --query 'taskDefinition.taskDefinitionArn' \
        --output text
    }

    FRONTEND_ARN=$(register_task_def \
      "${APP}-frontend-${ENV}" \
      "${ECR_BASE}/${APP}-frontend:${SHA}")

    BACKEND_ARN=$(register_task_def \
      "${APP}-backend-${ENV}" \
      "${ECR_BASE}/${APP}-backend:${SHA}")

    MIGRATOR_ARN=$(register_task_def \
      "${APP}-migrator-${ENV}" \
      "${ECR_BASE}/${APP}-backend-migrator:${SHA}")

    echo "FRONTEND_ARN=${FRONTEND_ARN}" >> "$GITHUB_OUTPUT"
    echo "BACKEND_ARN=${BACKEND_ARN}"   >> "$GITHUB_OUTPUT"
    echo "MIGRATOR_ARN=${MIGRATOR_ARN}" >> "$GITHUB_OUTPUT"
```

#### 2-3. Run migration task の修正

`--task-definition` を新しいARNに変更し、無効な `--overrides` の `image` フィールドを削除する。

```yaml
- name: Run migration task
  id: migration
  run: |
    SUBNET_ID=$(aws ec2 describe-subnets \
      --filters 'Name=tag:Name,Values=*Public*' \
      --query 'Subnets[0].SubnetId' --output text)
    SG_ID=$(aws ec2 describe-security-groups \
      --filters 'Name=tag:Name,Values=*FargateSg*' \
      --query 'SecurityGroups[0].GroupId' --output text)

    TASK_ARN=$(aws ecs run-task \
      --cluster ${{ vars.APP_NAME }}-${{ inputs.environment }} \
      --task-definition "${{ steps.register_tasks.outputs.MIGRATOR_ARN }}" \
      --launch-type FARGATE \
      --network-configuration "awsvpcConfiguration={subnets=[${SUBNET_ID}],securityGroups=[${SG_ID}],assignPublicIp=ENABLED}" \
      --query 'tasks[0].taskArn' --output text)
    # --overrides の image フィールドは廃止（ECS は image の上書きをサポートしない）

    echo "MIGRATION_TASK_ARN=${TASK_ARN}" >> deploy-record.txt
    aws ecs wait tasks-stopped \
      --cluster ${{ vars.APP_NAME }}-${{ inputs.environment }} \
      --tasks "${TASK_ARN}"

    EXIT_CODE=$(aws ecs describe-tasks \
      --cluster ${{ vars.APP_NAME }}-${{ inputs.environment }} \
      --tasks "${TASK_ARN}" \
      --query 'tasks[0].containers[0].exitCode' --output text)
    if [ "$EXIT_CODE" != "0" ]; then
      echo "Migration failed with exit code ${EXIT_CODE}"
      exit 1
    fi
    echo "MIGRATION_STATUS=success" >> deploy-record.txt
```

#### 2-4. Update ECS services の修正

`--force-new-deployment` を廃止し、新しいタスク定義ARNを明示指定する。

```yaml
- name: Update ECS services
  id: ecs_update
  run: |
    APP="${{ vars.APP_NAME }}"
    ENV="${{ inputs.environment }}"

    # ロールバック用に現在のタスク定義ARNを保存（update-service前）
    PREV_FRONTEND_ARN=$(aws ecs describe-services \
      --cluster "${APP}-${ENV}" \
      --services "${APP}-frontend-${ENV}" \
      --query 'services[0].taskDefinition' --output text)
    PREV_BACKEND_ARN=$(aws ecs describe-services \
      --cluster "${APP}-${ENV}" \
      --services "${APP}-backend-${ENV}" \
      --query 'services[0].taskDefinition' --output text)

    echo "PREV_FRONTEND_ARN=${PREV_FRONTEND_ARN}" >> "$GITHUB_OUTPUT"
    echo "PREV_BACKEND_ARN=${PREV_BACKEND_ARN}"   >> "$GITHUB_OUTPUT"
    echo "PREV_FRONTEND_ARN=${PREV_FRONTEND_ARN}" >> deploy-record.txt
    echo "PREV_BACKEND_ARN=${PREV_BACKEND_ARN}"   >> deploy-record.txt

    aws ecs update-service \
      --cluster "${APP}-${ENV}" \
      --service "${APP}-frontend-${ENV}" \
      --task-definition "${{ steps.register_tasks.outputs.FRONTEND_ARN }}"

    aws ecs update-service \
      --cluster "${APP}-${ENV}" \
      --service "${APP}-backend-${ENV}" \
      --task-definition "${{ steps.register_tasks.outputs.BACKEND_ARN }}"
```

#### 2-5. Rollback on failure の修正

リビジョン番号の計算（`-1`）を廃止し、保存済みの前のARNを直接使う。

```yaml
- name: Rollback on failure
  if: failure() && steps.ecs_update.outcome == 'success'
  run: |
    APP="${{ vars.APP_NAME }}"
    ENV="${{ inputs.environment }}"

    aws ecs update-service \
      --cluster "${APP}-${ENV}" \
      --service "${APP}-frontend-${ENV}" \
      --task-definition "${{ steps.ecs_update.outputs.PREV_FRONTEND_ARN }}"

    aws ecs update-service \
      --cluster "${APP}-${ENV}" \
      --service "${APP}-backend-${ENV}" \
      --task-definition "${{ steps.ecs_update.outputs.PREV_BACKEND_ARN }}"
```

---

## 修正後のデプロイフロー全体図

```
push to develop/main
  ↓
Build & push（SHAタグのみ）
  ↓
Register task definitions（CDKのインフラ設定 + SHAタグimage → 新リビジョン登録）
  ├─ frontend-dev:N   → image: .../frontend:abc1234
  ├─ backend-dev:N    → image: .../backend:abc1234
  └─ migrator-dev:N   → image: .../backend-migrator:abc1234
  ↓
Run migration（migrator:N のARNで実行）
  ↓
Update ECS services（frontend:N / backend:N のARNで更新）
  ↓
services-stable 待機
  ↓
失敗時 → 保存済みの前のARNでupdate-service（確実に前のコードに戻る）
```

---

## 注意事項・前提確認

### IAM権限の確認

`github-actions-deploy-role` に以下の権限があること：

```json
{
  "Effect": "Allow",
  "Action": [
    "ecs:RegisterTaskDefinition",
    "ecs:DescribeTaskDefinition",
    "ecs:DescribeServices"
  ],
  "Resource": "*"
}
```

`iam:PassRole` は `register-task-definition` でexecutionRoleを指定するために必要。既存ロールARNを渡す場合は以下も必要：

```json
{
  "Effect": "Allow",
  "Action": "iam:PassRole",
  "Resource": "arn:aws:iam::<ACCOUNT_ID>:role/*TaskExecutionRole*"
}
```

### ECRライフサイクルポリシー（推奨）

latestタグを廃止するとSHAタグが無限に積み上がる。ECRリポジトリに以下のライフサイクルポリシーを設定することを推奨する（必須ではないが、ストレージコスト管理のため）：

```json
{
  "rules": [
    {
      "rulePriority": 1,
      "description": "最新10世代のみ保持",
      "selection": {
        "tagStatus": "tagged",
        "tagPrefixList": [],
        "countType": "imageCountMoreThan",
        "countNumber": 10
      },
      "action": { "type": "expire" }
    }
  ]
}
```

CDKでは `ecr.Repository` の `lifecycleRules` プロパティで設定できる。

### CDK初回デプロイ後の運用

CDKの `app-stack.ts` はlatestタグをプレースホルダーとして保持する。初回CDKデプロイ直後はlatestタグが存在しないためサービス起動に失敗するが、その後CIがアプリをデプロイすると正常なリビジョンが登録されてサービスが起動する。

---

## 実装順序

1. IAM権限の確認・追加（`github-actions-deploy-role`）
2. `reusable-app-deploy.yml` の修正（上記2-1〜2-5）
3. `infra/lib/app/app-stack.ts` へのコメント追加（任意）
4. `infra/lib/app/app-stack.ts` へのECRライフサイクルポリシー追加（任意）
5. dev環境でデプロイ動作確認
