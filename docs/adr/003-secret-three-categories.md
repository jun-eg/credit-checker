# ADR 003: Secret を 3 分類で管理する

## ステータス

採用

## コンテキスト

アプリケーションの設定値には機密度に差があり、すべてを同じ方法で管理するのは過剰または不十分になりやすい。

## 決定

設定値を以下の **3 分類** に分けて管理する。

| 分類 | 具体例 | 管理方法 |
|------|--------|----------|
| **公開設定** | `NODE_ENV`, `AWS_REGION`, `FRONTEND_URL`, `AUTH_GOOGLE_ID` | ECS タスク定義の `environment` に平文で渡す |
| **インフラ設定** | `POSTGRES_USER`, `POSTGRES_PASSWORD`（ローカルのみ） | ローカルは `.env`、本番は RDS 自動生成シークレット |
| **Strong Secret** | `JWT_SECRET`, `AUTH_SECRET`, `GOOGLE_SECRET`, `OPENAI_API_KEY`, `DATABASE_URL` | Secrets Manager に登録し、sidecar が `/run/secrets/` へ書き込む |

## 理由

- **公開設定** を Secrets Manager に入れると管理コストと参照レイテンシが増える。環境名・リージョン・URL は機密ではないため平文で渡すのが適切
- **Strong Secret** をコードや環境変数（`environment:`）で渡すと、タスク定義・ログ・設定ファイルに残るリスクがある。ファイルマウント（`/run/secrets/`）にすることでメモリ上にしか残らない
- ローカル開発でも同じパス（`/run/secrets/`）を使うことで、本番と開発の差異をアプリコードから排除できる

## トレードオフ

- sidecar コンテナの実装・ビルドが必要になるが、一度実装すれば全サービスで再利用できる
- `/run/secrets/` のパーミッション管理が必要（コンテナ間の shared volume）
