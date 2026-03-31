# Issue #106 実装計画書

バックエンド ECS タスク定義から不要なシークレット注入を削除する

親 Issue: #100

---

## 背景・目的

`infra/lib/app/app-stack.ts` のバックエンドタスク定義に `AUTH_SECRET` と `AUTH_GOOGLE_SECRET` が注入されているが、バックエンドコードはこれらを一切参照していない。

これらは Next Auth v5 が使う認証用シークレットであり、フロントエンドコンテナにのみ必要な値である。バックエンドに不要なシークレットを注入することは最小権限の原則に反し、タスク定義の意図を読みにくくする。

---

## 現状の問題コード

### `infra/lib/app/app-stack.ts:104-121`（バックエンドコンテナ定義の抜粋）

```typescript
backendTask.addContainer('backend', {
  image: ecs.ContainerImage.fromEcrRepository(backendRepo, 'latest'),
  portMappings: [{ containerPort: config.ports.backend }],
  environment: {
    NODE_ENV: 'production',
    AWS_REGION: config.env.region,
    S3_BUCKET_NAME: config.s3BucketName,
    FRONTEND_URL: `https://${config.domain}`,
  },
  secrets: {
    JWT_SECRET: ecs.Secret.fromSecretsManager(appSecret, 'jwt_secret'),
    AUTH_SECRET: ecs.Secret.fromSecretsManager(appSecret, 'auth_secret'),         // ← 不要
    AUTH_GOOGLE_SECRET: ecs.Secret.fromSecretsManager(appSecret, 'auth_google_secret'), // ← 不要
    OPENAI_API_KEY: ecs.Secret.fromSecretsManager(appSecret, 'openai_api_key'),
    DATABASE_URL: ecs.Secret.fromSecretsManager(appSecret, 'database_url'),
  },
  logging: ecs.LogDrivers.awsLogs({ streamPrefix: 'backend' }),
});
```

### バックエンドにおける参照確認

`apps/backend/src/` 全体で以下を検索しても参照がない：

```bash
grep -r "AUTH_SECRET\|AUTH_GOOGLE_SECRET" apps/backend/src/
# → ヒットなし（secrets.ts にエクスポート定義があるのみ）
```

バックエンドで実際に使われるシークレットは：

| シークレット | 使用箇所 |
|------------|---------|
| `JWT_SECRET` | `auth.module.ts`: JwtModule の secret、`jwt.strategy.ts`: secretOrKey |
| `OPENAI_API_KEY` | `app.module.ts`: ConfigModule 経由で ChatModule などが参照 |
| `DATABASE_URL` | `app.module.ts`: TypeOrmModule の url、`run-migration.sh` |

`AUTH_SECRET` / `AUTH_GOOGLE_SECRET` はフロントエンドの Next Auth v5 が使うシークレット（OAuth セッションの署名・暗号化用）であり、バックエンドには不要。

---

## 実装方針

バックエンドタスク定義の `secrets:` フィールドから `AUTH_SECRET` と `AUTH_GOOGLE_SECRET` を削除する。

CDK assertions テスト（`infra/test/app.test.ts`）に `AUTH_SECRET` / `AUTH_GOOGLE_SECRET` がバックエンドコンテナに注入されることを確認するテストがある場合は、同 PR で削除する。逆に「注入されないこと」を確認するテストは追加しない（存在しないことのテストは意図が伝わりにくく価値が低い）。

---

## 実装手順

### Step 1: `infra/lib/app/app-stack.ts` を修正する

`backendTask.addContainer` の `secrets:` フィールドから `AUTH_SECRET` と `AUTH_GOOGLE_SECRET` を削除する。

**変更前**（`app-stack.ts:113-119`）:
```typescript
secrets: {
  JWT_SECRET: ecs.Secret.fromSecretsManager(appSecret, 'jwt_secret'),
  AUTH_SECRET: ecs.Secret.fromSecretsManager(appSecret, 'auth_secret'),
  AUTH_GOOGLE_SECRET: ecs.Secret.fromSecretsManager(appSecret, 'auth_google_secret'),
  OPENAI_API_KEY: ecs.Secret.fromSecretsManager(appSecret, 'openai_api_key'),
  DATABASE_URL: ecs.Secret.fromSecretsManager(appSecret, 'database_url'),
},
```

**変更後**:
```typescript
secrets: {
  JWT_SECRET: ecs.Secret.fromSecretsManager(appSecret, 'jwt_secret'),
  OPENAI_API_KEY: ecs.Secret.fromSecretsManager(appSecret, 'openai_api_key'),
  DATABASE_URL: ecs.Secret.fromSecretsManager(appSecret, 'database_url'),
},
```

### Step 2: `infra/test/app.test.ts` への影響を確認する

現在の `app.test.ts` に `AUTH_SECRET` / `AUTH_GOOGLE_SECRET` がバックエンドコンテナに注入されることを確認するテストが**存在しない**ことを確認する（issue #104 で追加されたテストを参照）。

現在のテスト内容（確認済み）:
- `backend コンテナに DATABASE_URL secret が設定されていること` ← 残す
- `backend コンテナに JWT_SECRET secret が設定されていること` ← 残す
- `frontend コンテナに AUTH_SECRET secret が設定されていること` ← 残す（フロントエンドには引き続き必要）
- `migrator コンテナに DATABASE_URL secret が設定されていること` ← 残す

`AUTH_SECRET` をバックエンドに注入することを確認するテストは存在しないため、`app.test.ts` の変更は不要。

### Step 3: CDK synth でテンプレートを確認する

```bash
cd infra
npx cdk synth -c env=dev
```

生成された CloudFormation テンプレートで `DevApp` スタックの `BackendTask` のコンテナ定義を確認し、`AUTH_SECRET` / `AUTH_GOOGLE_SECRET` が `Secrets` 配列から削除されていることを確認する。

```bash
# テンプレートから BackendTask の Secrets を確認
npx cdk synth -c env=dev | grep -A 5 'AUTH_SECRET'
# → バックエンドのタスク定義からは消え、フロントエンドのタスク定義にのみ残ること
```

### Step 4: CDK assertions テストを実行する

```bash
cd infra
npm test
```

全テストが GREEN で通ることを確認する。

---

## 完了判定

- [ ] `infra/lib/app/app-stack.ts` のバックエンドコンテナ定義の `secrets:` から `AUTH_SECRET` が削除されている
- [ ] `infra/lib/app/app-stack.ts` のバックエンドコンテナ定義の `secrets:` から `AUTH_GOOGLE_SECRET` が削除されている
- [ ] フロントエンドコンテナ定義の `AUTH_SECRET` / `AUTH_GOOGLE_SECRET` は削除されていない（フロントエンドには引き続き必要）
- [ ] `npx cdk synth -c env=dev` が成功する
- [ ] `npm test` が全テスト GREEN で通る

---

## 影響ファイル

| ファイル | 変更種別 |
|---------|---------|
| `infra/lib/app/app-stack.ts` | 修正（バックエンドタスクの不要シークレット削除） |

`infra/test/app.test.ts` は変更不要（バックエンドへの `AUTH_SECRET` 注入を確認するテストが存在しないため）。

---

## 注意事項

### フロントエンドコンテナの `AUTH_SECRET` / `AUTH_GOOGLE_SECRET` は維持すること

`frontendTask.addContainer` の `secrets:` フィールドにある `AUTH_SECRET` / `AUTH_GOOGLE_SECRET` は Next Auth v5 に必要なため、削除しないこと。

```typescript
// frontendTask（削除禁止）
secrets: {
  AUTH_SECRET: ecs.Secret.fromSecretsManager(appSecret, 'auth_secret'),
  AUTH_GOOGLE_SECRET: ecs.Secret.fromSecretsManager(appSecret, 'auth_google_secret'),
},
```

### CDK デプロイ時の影響

この変更によりバックエンドの TaskDefinition に新しい revision が作成される。デプロイ後に ECS がサービスを更新するため、一時的なローリングアップデートが発生する。既存の動作に影響はない（env var を参照しているコードがないため）。

### Issue #105 との実装順序

Issue #105（`secrets.ts` リファクタリング）と本 Issue（タスク定義修正）は互いに独立しており、どちらを先に実装しても構わない。ただし、両方とも `apps/backend/` と `infra/` を別ディレクトリで修正するため、同一 PR にまとめてもよい。
