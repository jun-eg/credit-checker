# Issue #100 実装計画書

issue #100「インフラ・開発環境を全面刷新（prod-shaped, dev-sized）」の実装手順書。

設計の詳細は [issue #100](https://github.com/jun-eg/credit-checker/issues/100) を参照。

---

## 依存関係と実装順序

```
Phase 0: AWS アカウント構成
    ↓
Phase 1: ローカル開発環境の整備（Phase 0 と並行可）
    ↓
Phase 2: リポジトリ構成の刷新
    ↓
Phase 3: CDK 基盤の実装
    ↓
Phase 4: コンテナ整備
    ↓
Phase 5: Secret 管理
    ↓
Phase 6: CI/CD の実装
    ↓
Phase 7: ドキュメント整備（各 Phase と並行して記録）
    ↓
Phase 8: 廃止作業
```

---

## Phase 0: AWS アカウント構成

**前提**: このフェーズが完了するまで CDK の実装には着手しない。

### 0-1. AWS Organizations の有効化

```
management アカウント（既存 or 新規）で Organizations を有効化する。
ルート OU を作成し、その下に Workloads OU を作成する。
```

### 0-2. アカウントの作成

Organizations コンソールから以下を作成する。

| アカウント名 | 用途 | 備考 |
|------------|------|------|
| `credit-checker-management` | 請求・管理 | Organizations のルートアカウント |
| `credit-checker-dev` | 開発・検証 | 壊してよい環境 |
| `credit-checker-prod` | 本番 | 変更は CDK + CI/CD 経由のみ |

### 0-3. 各アカウントの初期設定

各アカウントで以下を実施する。

```bash
# CDK bootstrap（各アカウント × リージョンで1回だけ必要）
# dev アカウントの認証情報で実行
cdk bootstrap aws://<dev-account-id>/ap-northeast-1

# prod アカウントの認証情報で実行
cdk bootstrap aws://<prod-account-id>/ap-northeast-1
```

### 0-4. OIDC プロバイダの設定

各アカウント（dev / prod）で GitHub Actions 用の OIDC プロバイダを作成する。

```
Provider URL: https://token.actions.githubusercontent.com
Audience:     sts.amazonaws.com
```

### 0-5. IAM Role の作成（OIDC 用）

各アカウントで GitHub Actions がアサインする IAM Role を作成する。

```json
// Trust Policy
{
  "Effect": "Allow",
  "Principal": {
    "Federated": "arn:aws:iam::<account-id>:oidc-provider/token.actions.githubusercontent.com"
  },
  "Action": "sts:AssumeRoleWithWebIdentity",
  "Condition": {
    "StringEquals": {
      "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
    },
    "StringLike": {
      "token.actions.githubusercontent.com:sub": "repo:jun-eg/credit-checker:*"
    }
  }
}
```

付与するポリシー:
- `AmazonECS_FullAccess`
- `AmazonEC2ContainerRegistryFullAccess`
- `AmazonSSMReadOnlyAccess`（Secrets Manager 参照用）
- `CloudFormationFullAccess`（CDK deploy 用）

### 0-6. GitHub Secrets / Variables の設定

| 名前 | 種別 | 値 |
|------|------|-----|
| `DEV_AWS_ACCOUNT_ID` | Secret | dev アカウント ID |
| `PROD_AWS_ACCOUNT_ID` | Secret | prod アカウント ID |
| `AWS_REGION` | Variable | `ap-northeast-1` |

**検証**: AWS コンソールで各アカウントにログインできること、OIDC プロバイダが作成されていること。

---

## Phase 1: ローカル開発環境の整備

**目的**: `docker compose up` だけで動く状態にする（AWS 接続不要）。

### 1-1. 現状確認

```bash
# ルートで実行
docker compose up

# 以下を確認する
# - frontend: http://localhost:3000 でアクセスできるか
# - backend:  http://localhost:3003/api/v1 でアクセスできるか
# - AWS サービスへの接続エラーが出ていないか（ログを確認）
```

エラーがある場合は原因を特定し、LocalStack または環境変数で解消する。

### 1-2. Docker Compose secrets の設定

strong secret をファイルマウントに移行する。AWS と同じパス（`/run/secrets/<name>`）を使う。

```bash
# secrets/ ディレクトリを作成（.gitignore に追加済みであることを確認）
mkdir -p secrets/
echo "secrets/" >> .gitignore
```

`secrets/` 配下に以下のファイルを作成（値は既存の `.env` からコピー）:

```
secrets/jwt_secret
secrets/auth_secret
secrets/auth_google_secret
secrets/openai_api_key
secrets/database_url
```

`docker-compose.yml` に secrets セクションを追加する:

```yaml
secrets:
  jwt_secret:
    file: ./secrets/jwt_secret
  auth_secret:
    file: ./secrets/auth_secret
  auth_google_secret:
    file: ./secrets/auth_google_secret
  openai_api_key:
    file: ./secrets/openai_api_key
  database_url:
    file: ./secrets/database_url

services:
  backend:
    secrets:
      - jwt_secret
      - auth_secret
      - auth_google_secret
      - openai_api_key
      - database_url
    # 環境変数からの読み込みを削除し、/run/secrets/<name> から読むように変更

  frontend:
    secrets:
      - auth_secret
      - auth_google_secret
```

### 1-3. アプリ側の secret 読み込みを変更

backend / frontend が環境変数ではなくファイルから読むように変更する。

```typescript
// backend: src/config/secrets.ts（新規作成）
import { readFileSync } from 'fs';

function readSecret(name: string): string {
  const filePath = `/run/secrets/${name}`;
  try {
    return readFileSync(filePath, 'utf8').trim();
  } catch {
    // ローカル開発で secrets/ が未作成の場合のフォールバック
    const envValue = process.env[name.toUpperCase()];
    if (!envValue) throw new Error(`Secret ${name} not found`);
    return envValue;
  }
}

export const secrets = {
  jwtSecret:       () => readSecret('jwt_secret'),
  authSecret:      () => readSecret('auth_secret'),
  googleSecret:    () => readSecret('auth_google_secret'),
  openaiApiKey:    () => readSecret('openai_api_key'),
  databaseUrl:     () => readSecret('database_url'),
};
```

### 1-4. `.env.example` の整備

本番稼働に必要なすべての変数を記載する（値は入れない）。

```bash
# .env.example
# === 公開してよい設定（ECS environment に平文で渡す） ===
NODE_ENV=
AWS_REGION=
S3_BUCKET_NAME=
FRONTEND_URL=
BACKEND_URL=
AUTH_URL=
AUTH_GOOGLE_ID=

# === 強い secret（Secrets Manager に登録 / ローカルは secrets/ ファイル） ===
# 以下は secrets/ 配下のファイルとして管理する
# DATABASE_URL=
# JWT_SECRET=
# AUTH_SECRET=
# AUTH_GOOGLE_SECRET=
# OPENAI_API_KEY=
```

**検証**:
```bash
docker compose up
# frontend / backend ともにエラーなく起動すること
# http://localhost:3000 でログインフローが動作すること
```

---

## Phase 2: リポジトリ構成の刷新

### 2-1. ディレクトリ構成の変更

現在のルート直下にある `frontend/` `backend/` を `apps/` 配下に移動する。

```bash
mkdir -p apps
git mv frontend apps/frontend
git mv backend apps/backend
```

Dockerfile の `COPY` パスを修正する:

```dockerfile
# apps/frontend/Dockerfile（変更前）
COPY frontend/package.json ...
# 変更後（build context がルートのまま）
COPY apps/frontend/package.json ...
```

`docker-compose.yml` の `build.context` と `dockerfile` を修正する:

```yaml
services:
  frontend:
    build:
      context: .
      dockerfile: apps/frontend/Dockerfile
  backend:
    build:
      context: .
      dockerfile: apps/backend/Dockerfile
```

### 2-2. docs/ の構造整備

```bash
mkdir -p docs/adr
mkdir -p docs/architecture
mkdir -p docs/runbooks
```

### 2-3. docs/aws-design.md の扱い

旧設計書（EC2 ベース）は削除せず、冒頭に廃止注記を追加してアーカイブする。

```markdown
<!-- このファイルは廃止済みです。新設計は issue #100 および docs/architecture/ を参照してください。 -->
```

**検証**:
```bash
docker compose up
# ディレクトリ移動後も正常に起動すること
```

---

## Phase 3: CDK 基盤の実装

### 3-1. CDK プロジェクトの初期化

```bash
mkdir infra && cd infra
npx cdk init app --language typescript
npm install
```

生成されたファイルのうち、使わないものを削除し以下の構成にする:

```
infra/
├── bin/app.ts
├── config/
│   ├── index.ts
│   ├── dev.ts
│   └── prod.ts
├── constructs/
├── lib/
│   ├── network/
│   ├── data/
│   ├── app/
│   └── edge/
└── test/
```

### 3-2. EnvironmentConfig 型の定義

```typescript
// infra/config/index.ts
export interface EnvironmentConfig {
  envName: 'Dev' | 'Prod';
  env: {
    account: string;
    region: string;
  };
  domain: string;
  scaling: {
    frontend: { minCapacity: number; maxCapacity: number };
    backend:  { minCapacity: number; maxCapacity: number };
  };
  rds: {
    instanceType: string;
    multiAz: boolean;
  };
  vpc: {
    maxAzs: number;
  };
}
```

```typescript
// infra/config/dev.ts
import { EnvironmentConfig } from './index';

export const devConfig: EnvironmentConfig = {
  envName: 'Dev',
  env: {
    account: process.env.DEV_AWS_ACCOUNT_ID!,
    region: 'ap-northeast-1',
  },
  domain: 'dev.jun-eg.site',
  scaling: {
    frontend: { minCapacity: 0, maxCapacity: 2 },
    backend:  { minCapacity: 0, maxCapacity: 2 },
  },
  rds: {
    instanceType: 'db.t4g.micro',
    multiAz: false,
  },
  vpc: {
    maxAzs: 1,
  },
};
```

```typescript
// infra/config/prod.ts
import { EnvironmentConfig } from './index';

export const prodConfig: EnvironmentConfig = {
  envName: 'Prod',
  env: {
    account: process.env.PROD_AWS_ACCOUNT_ID!,
    region: 'ap-northeast-1',
  },
  domain: 'jun-eg.site',
  scaling: {
    frontend: { minCapacity: 1, maxCapacity: 3 },
    backend:  { minCapacity: 1, maxCapacity: 3 },
  },
  rds: {
    instanceType: 'db.t4g.micro',
    multiAz: true,
  },
  vpc: {
    maxAzs: 2,
  },
};
```

### 3-3. bin/app.ts の実装

```typescript
// infra/bin/app.ts
import * as cdk from 'aws-cdk-lib';
import { devConfig } from '../config/dev';
import { prodConfig } from '../config/prod';
import { NetworkStack } from '../lib/network/network-stack';
import { DataStack }    from '../lib/data/data-stack';
import { AppStack }     from '../lib/app/app-stack';
import { EdgeStack }    from '../lib/edge/edge-stack';

const app = new cdk.App();
const targetEnv = app.node.tryGetContext('env') ?? 'dev';
const config = targetEnv === 'prod' ? prodConfig : devConfig;

const network = new NetworkStack(app, `${config.envName}Network`, { config, env: config.env });
const data    = new DataStack(app,    `${config.envName}Data`,    { config, env: config.env, vpc: network.vpc });
const appStack = new AppStack(app,   `${config.envName}App`,     { config, env: config.env, vpc: network.vpc, secret: data.appSecret });
new EdgeStack(app,                   `${config.envName}Edge`,    { config, env: config.env, service: appStack.service });
```

### 3-4. network stack の実装

```typescript
// infra/lib/network/network-stack.ts
// 作成するリソース:
// - VPC（maxAzs: config.vpc.maxAzs）
// - Public subnet（ALB・Fargate 用）
// - Private subnet（RDS 用）
// - S3 Gateway Endpoint（無料、S3 通信をインターネットに出さない）
// - Security Group: ALB 用（inbound 80/443 from 0.0.0.0/0）
// - Security Group: Fargate 用（inbound from ALB SG のみ、outbound 443/5432）
// - Security Group: RDS 用（inbound 5432 from Fargate SG のみ）
```

### 3-5. data stack の実装

```typescript
// infra/lib/data/data-stack.ts
// 作成するリソース:
// - RDS for PostgreSQL（config.rds の設定を使用）
//   - instanceType: config.rds.instanceType
//   - multiAz: config.rds.multiAz
//   - subnetGroup: private subnet
//   - securityGroups: [rds SG from network stack]
// - Secrets Manager シークレット（strong secrets 用）
//   - /credit-checker/{env}/jwt-secret
//   - /credit-checker/{env}/auth-secret
//   - /credit-checker/{env}/auth-google-secret
//   - /credit-checker/{env}/openai-api-key
//   - /credit-checker/{env}/database-url（RDS 接続文字列）
```

### 3-6. app stack の実装

```typescript
// infra/lib/app/app-stack.ts
// 作成するリソース:
// - ECR リポジトリ（frontend / backend）
// - ECS Cluster
// - TaskDefinition（frontend / backend）
//   - sidecar コンテナ: Secrets Manager から /run/secrets/ へ書き込む
//   - main コンテナ: /run/secrets/ から secret を読む
//   - shared volume: sidecar → main へファイルを渡す
// - ECS Service（frontend / backend）
//   - desiredCount: config.scaling.*.minCapacity
//   - assignPublicIp: ENABLED（public subnet 配置）
//   - securityGroups: [fargate SG from network stack]
// - migration 専用 TaskDefinition
//   - CMD: typeorm migration:run
//   - sidecar で DATABASE_URL を /run/secrets/ に注入
// - AutoScaling（CPUUtilization 70% をターゲット）
```

### 3-7. edge stack の実装

```typescript
// infra/lib/edge/edge-stack.ts
// 作成するリソース:
// - ACM 証明書（config.domain / DNS 検証）
// - ALB（public subnet）
//   - HTTP(80) → HTTPS リダイレクト
//   - HTTPS(443) → ターゲットグループ
//   - /api/* → backend ECS Service
//   - /*    → frontend ECS Service
// - CloudFront Distribution
//   - origin: ALB
//   - HTTPS only
// - Route53 A レコード（config.domain → CloudFront）
```

### 3-8. constructs の切り出し

以下を `constructs/` に切り出す:

| ファイル | 内容 |
|---------|------|
| `secret-sidecar.ts` | sidecar + shared volume パターン（TaskDefinition に適用） |
| `fargate-service.ts` | ECS Service + AutoScaling のセット（frontend / backend で共用） |
| `secure-rds.ts` | RDS + SubnetGroup + SG のセット |

### 3-9. test/ の実装

```typescript
// infra/test/network.test.ts
// 検証内容:
// - VPC が作成されていること
// - S3 Gateway Endpoint が作成されていること
// - Fargate SG の inbound が ALB SG からのみであること
// - Fargate SG の outbound が 443(0.0.0.0/0) と 5432(RDS SG) のみであること

// infra/test/data.test.ts
// 検証内容:
// - dev: RDS が Single-AZ であること（multiAz: false）
// - prod: RDS が Multi-AZ であること（multiAz: true）
// - Secrets Manager のシークレット名が正しいこと

// infra/test/app.test.ts
// 検証内容:
// - dev: ECS Service の desiredCount が 0 であること
// - prod: ECS Service の desiredCount が 1 であること
// - Fargate の assignPublicIp が ENABLED であること
// - sidecar コンテナが TaskDefinition に含まれていること
```

**検証**:
```bash
cd infra
npm test           # assertions テストが全て通ること
npx cdk synth -c env=dev   # CloudFormation テンプレートが生成されること
npx cdk synth -c env=prod
```

---

## Phase 4: コンテナ整備

### 4-1. Dockerfile の本番用整備

`apps/backend/Dockerfile` に migration 専用の target を追加する:

```dockerfile
# apps/backend/Dockerfile

FROM node:20-alpine AS builder
WORKDIR /app
COPY apps/backend/package.json apps/backend/package-lock.json ./
RUN npm ci
COPY apps/backend/ .
RUN npm run build

# --- migration runner ---
FROM node:20-alpine AS migrator
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
# DATABASE_URL は /run/secrets/database_url から読む
COPY apps/backend/scripts/run-migration.sh ./
RUN chmod +x run-migration.sh
CMD ["sh", "run-migration.sh"]

# --- app runner ---
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
EXPOSE 3003
CMD ["node", "dist/main"]
```

```bash
# apps/backend/scripts/run-migration.sh
#!/bin/sh
set -e
export DATABASE_URL=$(cat /run/secrets/database_url)
node_modules/.bin/typeorm migration:run -d dist/database/data-source.js
echo "Migration completed successfully"
```

### 4-2. sidecar コンテナの実装

Secrets Manager から値を取得して `/run/secrets/` に書き込む sidecar を実装する。

```dockerfile
# infra/constructs/sidecar/Dockerfile
FROM amazon/aws-cli:latest
COPY fetch-secrets.sh /fetch-secrets.sh
RUN chmod +x /fetch-secrets.sh
ENTRYPOINT ["/fetch-secrets.sh"]
```

```bash
# infra/constructs/sidecar/fetch-secrets.sh
#!/bin/sh
set -e

fetch_secret() {
  local name=$1
  local secret_id=$2
  aws secretsmanager get-secret-value \
    --secret-id "$secret_id" \
    --query SecretString \
    --output text > "/run/secrets/${name}"
  echo "Fetched: ${name}"
}

fetch_secret "database_url"     "${SECRET_DATABASE_URL_ARN}"
fetch_secret "jwt_secret"       "${SECRET_JWT_ARN}"
fetch_secret "auth_secret"      "${SECRET_AUTH_ARN}"
fetch_secret "auth_google_secret" "${SECRET_GOOGLE_ARN}"
fetch_secret "openai_api_key"   "${SECRET_OPENAI_ARN}"

echo "All secrets fetched"
```

**検証**:
```bash
# ローカルでビルドが通ること
docker build -f apps/backend/Dockerfile --target runner -t backend-app .
docker build -f apps/backend/Dockerfile --target migrator -t backend-migrator .
docker build -f apps/frontend/Dockerfile -t frontend-app .
```

---

## Phase 5: Secret 管理

### 5-1. Secrets Manager へのシークレット登録

dev / prod 各アカウントで以下を登録する（AWS CLI または コンソール）:

```bash
# dev アカウントで実行
aws secretsmanager create-secret \
  --name "/credit-checker/dev/database-url" \
  --secret-string "postgresql://..."

aws secretsmanager create-secret \
  --name "/credit-checker/dev/jwt-secret" \
  --secret-string "<value>"

# 以下同様に登録:
# /credit-checker/dev/auth-secret
# /credit-checker/dev/auth-google-secret
# /credit-checker/dev/openai-api-key
```

prod アカウントでも同様に `/credit-checker/prod/...` として登録する。

### 5-2. ECS Task Execution Role のポリシー設定

CDK の data stack で以下を定義する（Phase 3 の data stack 実装時に含める）:

```typescript
// Fargate task execution role に Secrets Manager の読み取りを付与
executionRole.addToPolicy(new iam.PolicyStatement({
  actions: ['secretsmanager:GetSecretValue'],
  resources: [`arn:aws:secretsmanager:${region}:${account}:secret:/credit-checker/${env}/*`],
}));
```

**検証**:
- ECS タスクが起動し、sidecar が `/run/secrets/` にファイルを書き込むこと
- main コンテナが `/run/secrets/database_url` を読み込んで RDS に接続できること

---

## Phase 6: CI/CD の実装

### 6-1. ci.yml の実装

```yaml
# .github/workflows/ci.yml
name: CI

on:
  pull_request:
    branches: [develop, main]

jobs:
  lint-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
        working-directory: apps/frontend
      - run: npm run lint && npm run test
        working-directory: apps/frontend
      - run: npm ci
        working-directory: apps/backend
      - run: npm run lint && npm run test
        working-directory: apps/backend

  cdk-assertions:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
        working-directory: infra
      - run: npm test
        working-directory: infra
```

### 6-2. reusable-infra-deploy.yml の実装

```yaml
# .github/workflows/reusable-infra-deploy.yml
name: Reusable - Infra Deploy

on:
  workflow_call:
    inputs:
      environment:
        required: true
        type: string   # 'dev' or 'prod'
    secrets:
      aws_account_id:
        required: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read
    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials (OIDC)
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::${{ secrets.aws_account_id }}:role/github-actions-deploy-role
          aws-region: ap-northeast-1

      - uses: actions/setup-node@v4
        with: { node-version: '20' }

      - run: npm ci
        working-directory: infra

      - name: CDK deploy
        run: npx cdk deploy --all -c env=${{ inputs.environment }} --require-approval never
        working-directory: infra
```

### 6-3. reusable-app-deploy.yml の実装

```yaml
# .github/workflows/reusable-app-deploy.yml
name: Reusable - App Deploy

on:
  workflow_call:
    inputs:
      environment:
        required: true
        type: string
    secrets:
      aws_account_id:
        required: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read
    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials (OIDC)
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::${{ secrets.aws_account_id }}:role/github-actions-deploy-role
          aws-region: ap-northeast-1

      - name: Login to ECR
        uses: aws-actions/amazon-ecr-login@v2

      - name: Set image tag
        id: meta
        run: echo "tag=${{ github.sha }}" >> "$GITHUB_OUTPUT"

      - name: Build and push frontend
        uses: docker/build-push-action@v5
        with:
          context: .
          file: apps/frontend/Dockerfile
          push: true
          tags: |
            ${{ secrets.aws_account_id }}.dkr.ecr.ap-northeast-1.amazonaws.com/credit-checker-frontend:${{ steps.meta.outputs.tag }}
            ${{ secrets.aws_account_id }}.dkr.ecr.ap-northeast-1.amazonaws.com/credit-checker-frontend:latest

      - name: Build and push backend
        uses: docker/build-push-action@v5
        with:
          context: .
          file: apps/backend/Dockerfile
          target: runner
          push: true
          tags: |
            ${{ secrets.aws_account_id }}.dkr.ecr.ap-northeast-1.amazonaws.com/credit-checker-backend:${{ steps.meta.outputs.tag }}
            ${{ secrets.aws_account_id }}.dkr.ecr.ap-northeast-1.amazonaws.com/credit-checker-backend:latest

      - name: Build and push backend-migrator
        uses: docker/build-push-action@v5
        with:
          context: .
          file: apps/backend/Dockerfile
          target: migrator
          push: true
          tags: |
            ${{ secrets.aws_account_id }}.dkr.ecr.ap-northeast-1.amazonaws.com/credit-checker-backend-migrator:${{ steps.meta.outputs.tag }}

      # rollback 根拠の記録
      - name: Record deploy metadata
        run: |
          echo "IMAGE_TAG=${{ steps.meta.outputs.tag }}" >> deploy-record.txt
          echo "ENVIRONMENT=${{ inputs.environment }}" >> deploy-record.txt
          echo "TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)" >> deploy-record.txt

      # ① migration task を先行実行
      - name: Run migration task
        id: migration
        run: |
          TASK_ARN=$(aws ecs run-task \
            --cluster credit-checker-${{ inputs.environment }} \
            --task-definition credit-checker-migrator-${{ inputs.environment }} \
            --launch-type FARGATE \
            --network-configuration "awsvpcConfiguration={subnets=[$(aws ec2 describe-subnets --filters 'Name=tag:Name,Values=*Public*' --query 'Subnets[0].SubnetId' --output text)],securityGroups=[$(aws ec2 describe-security-groups --filters 'Name=tag:Name,Values=*fargate*' --query 'SecurityGroups[0].GroupId' --output text)],assignPublicIp=ENABLED}" \
            --overrides '{"containerOverrides":[{"name":"migrator","image":"${{ secrets.aws_account_id }}.dkr.ecr.ap-northeast-1.amazonaws.com/credit-checker-backend-migrator:${{ steps.meta.outputs.tag }}}]}' \
            --query 'tasks[0].taskArn' --output text)
          echo "MIGRATION_TASK_ARN=${TASK_ARN}" >> deploy-record.txt
          aws ecs wait tasks-stopped --cluster credit-checker-${{ inputs.environment }} --tasks ${TASK_ARN}
          EXIT_CODE=$(aws ecs describe-tasks --cluster credit-checker-${{ inputs.environment }} --tasks ${TASK_ARN} \
            --query 'tasks[0].containers[0].exitCode' --output text)
          if [ "$EXIT_CODE" != "0" ]; then
            echo "Migration failed with exit code ${EXIT_CODE}"
            exit 1
          fi
          echo "MIGRATION_STATUS=success" >> deploy-record.txt

      # ② ECS Service を更新
      - name: Update ECS services
        id: ecs_update
        run: |
          # task definition の新リビジョンを取得
          FRONTEND_REVISION=$(aws ecs describe-task-definition \
            --task-definition credit-checker-frontend-${{ inputs.environment }} \
            --query 'taskDefinition.revision' --output text)
          BACKEND_REVISION=$(aws ecs describe-task-definition \
            --task-definition credit-checker-backend-${{ inputs.environment }} \
            --query 'taskDefinition.revision' --output text)

          echo "FRONTEND_TASK_DEF_REVISION=${FRONTEND_REVISION}" >> deploy-record.txt
          echo "BACKEND_TASK_DEF_REVISION=${BACKEND_REVISION}" >> deploy-record.txt

          aws ecs update-service \
            --cluster credit-checker-${{ inputs.environment }} \
            --service credit-checker-frontend \
            --force-new-deployment

          aws ecs update-service \
            --cluster credit-checker-${{ inputs.environment }} \
            --service credit-checker-backend \
            --force-new-deployment

      # ③ ヘルスチェック
      - name: Wait for stable
        run: |
          aws ecs wait services-stable \
            --cluster credit-checker-${{ inputs.environment }} \
            --services credit-checker-frontend credit-checker-backend

      # rollback: ヘルスチェック失敗時
      - name: Rollback on failure
        if: failure() && steps.ecs_update.outcome == 'success'
        run: |
          PREV_FRONTEND=$(( $(cat deploy-record.txt | grep FRONTEND_TASK_DEF_REVISION | cut -d= -f2) - 1 ))
          PREV_BACKEND=$(( $(cat deploy-record.txt | grep BACKEND_TASK_DEF_REVISION | cut -d= -f2) - 1 ))
          aws ecs update-service \
            --cluster credit-checker-${{ inputs.environment }} \
            --service credit-checker-frontend \
            --task-definition credit-checker-frontend-${{ inputs.environment }}:${PREV_FRONTEND}
          aws ecs update-service \
            --cluster credit-checker-${{ inputs.environment }} \
            --service credit-checker-backend \
            --task-definition credit-checker-backend-${{ inputs.environment }}:${PREV_BACKEND}
```

### 6-4. deploy.yml の実装（オーケストレーター）

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [develop, main]

jobs:
  # 変更箇所の検知
  detect-changes:
    runs-on: ubuntu-latest
    outputs:
      infra: ${{ steps.filter.outputs.infra }}
      apps:  ${{ steps.filter.outputs.apps }}
      env:   ${{ steps.env.outputs.name }}
    steps:
      - uses: actions/checkout@v4
      - uses: dorny/paths-filter@v3
        id: filter
        with:
          filters: |
            infra:
              - 'infra/**'
            apps:
              - 'apps/**'
      - name: Set environment name
        id: env
        run: |
          if [ "${{ github.ref }}" = "refs/heads/main" ]; then
            echo "name=prod" >> "$GITHUB_OUTPUT"
          else
            echo "name=dev" >> "$GITHUB_OUTPUT"
          fi

  # インフラデプロイ（infra/ に変更がある場合のみ）
  deploy-infra:
    needs: detect-changes
    if: needs.detect-changes.outputs.infra == 'true'
    uses: ./.github/workflows/reusable-infra-deploy.yml
    with:
      environment: ${{ needs.detect-changes.outputs.env }}
    secrets:
      aws_account_id: ${{ needs.detect-changes.outputs.env == 'prod' && secrets.PROD_AWS_ACCOUNT_ID || secrets.DEV_AWS_ACCOUNT_ID }}

  # アプリデプロイ（apps/ に変更がある場合のみ、infra デプロイの後に実行）
  deploy-app:
    needs: [detect-changes, deploy-infra]
    if: |
      always() &&
      needs.detect-changes.outputs.apps == 'true' &&
      (needs.deploy-infra.result == 'success' || needs.deploy-infra.result == 'skipped')
    uses: ./.github/workflows/reusable-app-deploy.yml
    with:
      environment: ${{ needs.detect-changes.outputs.env }}
    secrets:
      aws_account_id: ${{ needs.detect-changes.outputs.env == 'prod' && secrets.PROD_AWS_ACCOUNT_ID || secrets.DEV_AWS_ACCOUNT_ID }}
```

### 6-5. dev-shutdown.yml の実装

```yaml
# .github/workflows/dev-shutdown.yml
name: Dev Environment Shutdown

on:
  schedule:
    - cron: '0 15 * * *'  # UTC 15:00 = JST 0:00

jobs:
  shutdown:
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read
    steps:
      - name: Configure AWS credentials (OIDC)
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::${{ secrets.DEV_AWS_ACCOUNT_ID }}:role/github-actions-deploy-role
          aws-region: ap-northeast-1

      - name: Scale down ECS services
        run: |
          aws ecs update-service \
            --cluster credit-checker-dev \
            --service credit-checker-frontend \
            --desired-count 0
          aws ecs update-service \
            --cluster credit-checker-dev \
            --service credit-checker-backend \
            --desired-count 0
```

---

## Phase 7: ドキュメント整備

### 7-1. ADR の記録

各 ADR は `docs/adr/NNN-title.md` の形式で作成する。

**作成する ADR:**

| ファイル名 | 内容 |
|-----------|------|
| `001-fargate-public-subnet.md` | Fargate を public subnet + public IP にした理由（NAT Gateway を採らなかった理由） |
| `002-vpc-endpoint-deferred.md` | VPC Interface Endpoint を今は入れず将来に先送りした理由 |
| `003-secret-three-categories.md` | secret を3分類で管理する設計判断 |

### 7-2. architecture ドキュメントの作成

`docs/architecture/overview.md` に以下を記載する:

- システム全体構成図（Mermaid）
- リクエストの流れ（CloudFront → ALB → ECS → RDS）
- secret の流れ（Secrets Manager → sidecar → /run/secrets/ → app）
- deploy の流れ（GitHub Actions → ECR → migration task → ECS Service 更新）
- VPC / サブネット構成図

### 7-3. runbooks の作成

| ファイル名 | 内容 |
|-----------|------|
| `deploy.md` | デプロイ手順（通常・手動デプロイ） |
| `rollback.md` | アプリ rollback・インフラ rollback の手順 |
| `ecs-exec.md` | ECS Exec でコンテナに入る手順 |
| `secret-rotation.md` | Secrets Manager のシークレット更新手順 |
| `dev-startup.md` | dev 環境を手動で起動する手順（夜間停止後） |

---

## Phase 8: 廃止作業

**注意**: このフェーズは全 Phase の完了後、新環境の動作を確認してから実施する。

### 8-1. 新環境の動作確認

```
- [ ] dev 環境: https://dev.jun-eg.site でアプリが動作すること
- [ ] prod 環境: https://jun-eg.site でアプリが動作すること
- [ ] CI/CD: develop push → dev デプロイが成功すること
- [ ] CI/CD: main push → prod デプロイが成功すること
- [ ] migration: デプロイ時に migration task が正常に実行されること
- [ ] rollback: ヘルスチェック失敗時に自動 rollback されること
```

### 8-2. EC2 インスタンスの廃止

```bash
# EC2 インスタンスの停止（まず停止して様子を見る）
aws ec2 stop-instances --instance-ids <instance-id>

# 1週間問題がなければ終了
aws ec2 terminate-instances --instance-ids <instance-id>
```

### 8-3. 旧リソースの削除

```bash
# 旧 docker-compose.prod.yml の削除
git rm docker-compose.prod.yml

# 旧 nginx/ ディレクトリの削除（ALB に移行済み）
git rm -r nginx/

# 旧 deploy.yml の内容を新 deploy.yml に置き換え済みであることを確認
```

### 8-4. docs/issue-task/order.md の更新

`order.md` に issue #100 の完了を記録し、後続 issue の依存関係を更新する。

---

## 各 Phase の完了判定

| Phase | 完了条件 |
|-------|---------|
| 0 | 3アカウントが作成され、OIDC で GitHub Actions から各アカウントに認証できること |
| 1 | `docker compose up` 単体で動作し、ログイン〜レシート登録が完了できること |
| 2 | apps/ 移行後も docker compose up が動作すること |
| 3 | `npm test` が通り、`cdk synth` が dev / prod 両環境で成功すること |
| 4 | docker build が全 target でエラーなく通ること |
| 5 | ECS タスクが起動し、sidecar が /run/secrets/ へ書き込めること |
| 6 | develop push → dev デプロイ、main push → prod デプロイが自動実行されること |
| 7 | ADR 3件・architecture・runbooks が docs/ に揃っていること |
| 8 | EC2 が終了し、旧ファイルが repo から削除されていること |
