# Issue #105 実装計画書

`secrets.ts` を ADR 003 準拠に刷新（ファイル優先廃止・未使用エクスポート削除）

親 Issue: #100

---

## 背景・目的

ADR 003（2026-03-31 改訂）により Strong Secret の注入方法が「sidecar + `/run/secrets/` ファイル方式」から「ECS `secrets:` フィールドによる環境変数注入方式」に変更された。

しかし `apps/backend/src/config/secrets.ts` は旧方式前提の「ファイル優先 → env var フォールバック」のままになっており、以下の問題が残存している。

1. **ECS 本番環境で毎回 ENOENT 例外を発生させてから env var に落ちる**（例外ベースのフローが通常の起動パスになっている）
2. **バックエンドで使われない `authSecret()` / `googleSecret()` が残存している**（Next Auth v5 用でフロントエンドのみが使う）
3. **`app.module.ts` が `secrets.xxx()` 経由で env var を再ラップしており冗長**（env var → ファイル試行 → env var と二度読みしている）

ADR 003 の設計原則は「Strong Secret は ECS `secrets:` → 環境変数として統一注入し、アプリコードは env var を直接読む」である。

---

## 現状の問題コード

### `apps/backend/src/config/secrets.ts`（全体）

```typescript
import { readFileSync } from 'fs';

function readSecret(name: string): string {
  const filePath = `/run/secrets/${name}`;
  try {
    return readFileSync(filePath, 'utf8').trim();  // ECS 本番では常に ENOENT
  } catch {
    // ECS 本番ではここが実際のパス（例外制御フローが通常パスになっている）
    const envValue = process.env[name.toUpperCase()];
    if (!envValue) throw new Error(`Secret ${name} not found`);
    return envValue;
  }
}

export const secrets = {
  jwtSecret:    () => readSecret('jwt_secret'),       // app.module.ts で使用
  authSecret:   () => readSecret('auth_secret'),      // バックエンドでは未使用
  googleSecret: () => readSecret('auth_google_secret'), // バックエンドでは未使用
  openaiApiKey: () => readSecret('openai_api_key'),   // app.module.ts で使用
  databaseUrl:  () => readSecret('database_url'),     // app.module.ts で使用
};
```

### `apps/backend/src/app.module.ts`（抜粋）

```typescript
import { secrets } from './config/secrets';

ConfigModule.forRoot({
  isGlobal: true,
  load: [
    () => ({
      JWT_SECRET: secrets.jwtSecret(),       // 実態: env var → ファイル試行失敗 → env var
      OPENAI_API_KEY: secrets.openaiApiKey(),
      DATABASE_URL: secrets.databaseUrl(),
    }),
  ],
}),
TypeOrmModule.forRoot({
  url: secrets.databaseUrl(),                // 同上の二重経路
  // ...
}),
```

---

## 実装方針

### `secrets.ts` の方針

`readSecret()` を廃止し、env var を直接読む関数に置き換える。

- ECS 本番: `secrets:` フィールドで環境変数として注入済み → `process.env.XXX` を直接読む
- ローカル（docker compose）: `entrypoint` がファイルを読んで env var に変換してからコンテナを起動するため、コンテナ内では既に env var が存在する。`secrets.ts` 側での対応は不要

未使用の `authSecret()` / `googleSecret()` を削除する。

### `app.module.ts` の方針

`secrets.ts` 経由の間接読み込みを廃止し、`process.env` を直接渡す形に変える。

`ConfigModule` の `load` 関数はそのまま保持し、`process.env.JWT_SECRET` を直接渡すよう変更する（TypeORM の `url` も同様）。

---

## 実装手順

### Step 1: `apps/backend/src/config/secrets.ts` を書き換える

**変更前**:
```typescript
import { readFileSync } from 'fs';

function readSecret(name: string): string {
  const filePath = `/run/secrets/${name}`;
  try {
    return readFileSync(filePath, 'utf8').trim();
  } catch {
    const envValue = process.env[name.toUpperCase()];
    if (!envValue) throw new Error(`Secret ${name} not found`);
    return envValue;
  }
}

export const secrets = {
  jwtSecret:    () => readSecret('jwt_secret'),
  authSecret:   () => readSecret('auth_secret'),
  googleSecret: () => readSecret('auth_google_secret'),
  openaiApiKey: () => readSecret('openai_api_key'),
  databaseUrl:  () => readSecret('database_url'),
};
```

**変更後**:
```typescript
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Environment variable ${name} is not set`);
  return value;
}

export const secrets = {
  jwtSecret:    () => requireEnv('JWT_SECRET'),
  openaiApiKey: () => requireEnv('OPENAI_API_KEY'),
  databaseUrl:  () => requireEnv('DATABASE_URL'),
};
```

**変更のポイント**:
- `readFileSync` の import を削除（`fs` モジュール依存を排除）
- `authSecret()` / `googleSecret()` を削除（バックエンドで参照箇所なし）
- env var 名は大文字固定で明示（`process.env.JWT_SECRET` のように型から自明にする）
- 値がない場合のエラーメッセージを「どの変数か」が分かるよう改善

### Step 2: `apps/backend/src/app.module.ts` を更新する

`secrets.ts` から `authSecret` / `googleSecret` を削除したことで import が変わらないことを確認する（`jwtSecret`, `openaiApiKey`, `databaseUrl` は引き続き使用するため import はそのまま）。

**変更前**:
```typescript
import { secrets } from './config/secrets';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        () => ({
          JWT_SECRET: secrets.jwtSecret(),
          OPENAI_API_KEY: secrets.openaiApiKey(),
          DATABASE_URL: secrets.databaseUrl(),
        }),
      ],
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: secrets.databaseUrl(),
      // ...
    }),
```

**変更後**:
```typescript
import { secrets } from './config/secrets';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        () => ({
          JWT_SECRET: secrets.jwtSecret(),
          OPENAI_API_KEY: secrets.openaiApiKey(),
          DATABASE_URL: secrets.databaseUrl(),
        }),
      ],
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: secrets.databaseUrl(),
      // ...
    }),
```

`app.module.ts` の変更内容はなし。`secrets.ts` の実装が変わることで、内部の経路が「ファイル試行 → 例外 → env var」から「env var 直読み」に変わる。

### Step 3: 参照箇所がないことを確認する

`authSecret` / `googleSecret` の削除前に、バックエンドコードに参照がないことを確認する。

```bash
grep -r "authSecret\|googleSecret\|auth_secret\|auth_google_secret" apps/backend/src/
```

期待する結果: `apps/backend/src/config/secrets.ts` のみにヒット（削除対象ファイル自身）。

### Step 4: ローカルで起動確認する

```bash
docker compose up backend
```

- NestJS が正常に起動すること
- DB 接続が成功していること
- `ENOENT` / `no such file or directory` のようなエラーがログに出ていないこと

---

## 完了判定

- [ ] `apps/backend/src/config/secrets.ts` から `readFileSync` の import が削除されている
- [ ] `readSecret()` 関数が削除されている
- [ ] `authSecret()` / `googleSecret()` のエクスポートが削除されている
- [ ] `requireEnv()` に置き換わっており、`JWT_SECRET` / `OPENAI_API_KEY` / `DATABASE_URL` の3つのみがエクスポートされている
- [ ] `grep -r "authSecret\|googleSecret" apps/backend/src/` の結果が空（参照なし）
- [ ] `docker compose up backend` でエラーなく起動する

---

## 影響ファイル

| ファイル | 変更種別 |
|---------|---------|
| `apps/backend/src/config/secrets.ts` | リファクタリング（ロジック変更・エクスポート削減） |

`apps/backend/src/app.module.ts` は import 元の実装が変わるが、自ファイルのコードは変更不要。

---

## 注意事項

### ローカル（docker compose）との差異

`docker-compose.yml` の frontend には以下の entrypoint がある：

```yaml
entrypoint: "/bin/sh"
command:
  - "-c"
  - >
    export AUTH_SECRET=$(cat /run/secrets/auth_secret);
    export AUTH_GOOGLE_SECRET=$(cat /run/secrets/auth_google_secret);
    exec node server.js
```

これはフロントエンド用の変換処理であり、バックエンド側の変更とは無関係。バックエンドコンテナは docker compose secrets によって env var が既に設定されているわけではなく、backend サービスには `secrets:` ブロックでファイルマウントされている。

ただし NestJS 起動時に `secrets.ts` がファイルを読もうとするのではなく、ローカル環境では backend コンテナが `/run/secrets/database_url` ファイルを持っているはずだが、新しい実装では env var を読む。

したがってローカル（docker compose）の backend コンテナでは、`DATABASE_URL` などの env var が未設定の場合にエラーになる可能性がある。現在の `docker-compose.yml` を確認し、必要であれば backend サービスの `environment:` セクションに値を追加するか、起動スクリプトで変換する対応を行う。

**確認事項**: `docker-compose.yml` の backend サービスで `DATABASE_URL` 環境変数が設定されているかを確認する。現在は `secrets:` でファイルマウントのみでありenv varは未設定の可能性がある。その場合、以下のいずれかの対応が必要：

**対応案 A（推奨）**: backend サービスにも entrypoint を追加してファイルから env var に変換する

```yaml
backend:
  entrypoint: "/bin/sh"
  command:
    - "-c"
    - >
      export JWT_SECRET=$(cat /run/secrets/jwt_secret);
      export AUTH_SECRET=$(cat /run/secrets/auth_secret);
      export AUTH_GOOGLE_SECRET=$(cat /run/secrets/auth_google_secret);
      export OPENAI_API_KEY=$(cat /run/secrets/openai_api_key);
      export DATABASE_URL=$(cat /run/secrets/database_url);
      exec node dist/main
  secrets:
    - jwt_secret
    - auth_secret
    - auth_google_secret
    - openai_api_key
    - database_url
```

**対応案 B**: `docker-compose.yml` の backend に env var を直接記述する（`secrets/` ファイルが存在しない開発者向けの fallback 手段として `.env` に値を書く）

ADR 003 が「ローカルは Docker Compose secrets + entrypoint 変換」と明記しているため、対応案 A が ADR の設計意図に沿っている。

`docker-compose.yml` の backend サービスにも entrypoint 変換が必要かどうかを実装時に確認し、必要であれば同一 PR で対応する。
