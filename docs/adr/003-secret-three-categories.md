# ADR 003: Secret を 3 分類で管理する

## ステータス

採用（2026-03-31 改訂）

## コンテキスト

アプリケーションの設定値には機密度に差があり、すべてを同じ方法で管理するのは過剰または不十分になりやすい。

当初の実装では Strong Secret をすべて sidecar + `/run/secrets/` ファイル方式で管理する設計を採用していた。しかし Next Auth v5 / Prisma / OpenAI SDK などのフレームワーク・SDK は環境変数でシークレットを読む仕様であり、ファイル方式との間に設計上の齟齬が生じた。

根本的な問題を整理すると、**回避すべきは `environment:` フィールドへの平文記述であり、環境変数という仕組みそのものではない**。ECS には `secrets:` フィールドという標準機能があり、Secrets Manager から実行時に値を取得してコンテナへ環境変数として注入できる。この場合、値はタスク定義 JSON に残らないため、`environment:` 平文と `secrets:` フィールドはセキュリティ特性が大きく異なる。

## 決定

設定値を以下の **3 分類** に分けて管理する。Strong Secret の注入方法を「読み取り主体が誰か」で使い分ける。

| 分類 | 具体例 | 管理方法 |
|------|--------|----------|
| **公開設定** | `NODE_ENV`, `AWS_REGION`, `FRONTEND_URL`, `AUTH_GOOGLE_ID`, `DATABASE_SSL` | ECS タスク定義の `environment:` に平文で渡す |
| **インフラ設定** | `POSTGRES_USER`, `POSTGRES_PASSWORD`（ローカルのみ） | ローカルは `.env`、本番は RDS 自動生成シークレット |
| **Strong Secret** | `AUTH_SECRET`, `AUTH_GOOGLE_SECRET`, `DATABASE_URL`, `JWT_SECRET`, `OPENAI_API_KEY` | Secrets Manager に登録し、ECS `secrets:` フィールドで環境変数として注入する |

### Strong Secret の注入方法の原則

| 読み取り主体 | 注入方法 | 理由 |
|------------|---------|------|
| フレームワーク・SDK（Next Auth, Prisma, OpenAI SDK 等） | ECS `secrets:` フィールド → 環境変数 | フレームワーク側の仕様に合わせる。`environment:` 平文との違いはタスク定義に値が残らない点 |
| 自前のアプリコード | ECS `secrets:` フィールド → 環境変数（統一） | 注入方式を一本化してシンプルに保つ |

sidecar + `/run/secrets/` ファイル方式は廃止する。ECS `secrets:` フィールドが同等のセキュリティ特性を持ちつつ、フレームワーク互換性の問題を生じさせないため。

### ローカル開発

Docker Compose の `secrets:` ブロックでファイルマウントし、フレームワークが環境変数を要求する場合は `entrypoint` でファイルを読んで変換する。

```yaml
# docker-compose.yml
backend:
  entrypoint: "/bin/sh"
  command:
    - "-c"
    - >
      export JWT_SECRET=$(cat /run/secrets/jwt_secret);
      export OPENAI_API_KEY=$(cat /run/secrets/openai_api_key);
      export DATABASE_URL=$(cat /run/secrets/database_url);
      exec node dist/main

frontend:
  entrypoint: "/bin/sh"
  command:
    - "-c"
    - >
      export AUTH_SECRET=$(cat /run/secrets/auth_secret);
      export AUTH_GOOGLE_SECRET=$(cat /run/secrets/auth_google_secret);
      exec node server.js
```

本番（ECS）との差異はこの変換処理のみであり、アプリコード自体には環境差異を持ち込まない。

## 理由

- **公開設定** を Secrets Manager に入れると管理コストと参照レイテンシが増える。環境名・リージョン・URL は機密ではないため平文で渡すのが適切
- **Strong Secret** を `environment:` 平文で渡すと、タスク定義 JSON・CloudFormation テンプレート・CDK 出力に値が残るリスクがある。`secrets:` フィールドを使うことでタスク定義に値を残さず、実行時に Secrets Manager から取得できる
- ECS `secrets:` フィールドと sidecar + ファイル方式はインフラレベルのセキュリティ特性がほぼ同等。sidecar は実装コストと dev parity の維持コストを生むだけで優位性がない
- 12-factor app の設計思想（フレームワーク・SDK が環境変数でシークレットを読む）と整合する

## トレードオフ

- ECS `secrets:` フィールドを使うため、ローカルとの差異が生じる（ローカルは Docker Compose secrets + entrypoint 変換）
- sidecar の廃止により、コンテナ間共有ボリュームの管理が不要になりシンプルになる
