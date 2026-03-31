# レシート管理アプリ

レシートの写真を保存・解析し、LLMとの対話形式で支出状況を確認できるWebアプリケーション。

## 機能

- レシート画像のアップロード・管理
- GPT-4o Vision による自動解析（店名・金額・商品明細・カテゴリ分類）
- チャット形式での支出照会（例：「今月の食費は？」「先月と比べてどう？」）
- 月次・カテゴリ別サマリー表示

## 技術スタック

| 領域           | 技術                              |
| -------------- | --------------------------------- |
| フロントエンド | Next.js (App Router)              |
| バックエンド   | NestJS                            |
| データベース   | PostgreSQL（本番: RDS）           |
| 画像ストレージ | AWS S3（ローカル: LocalStack）    |
| 認証           | NextAuth.js（Google OAuth）       |
| LLM            | OpenAI GPT-4o                     |
| インフラ定義   | AWS CDK (TypeScript)              |
| デプロイ       | ECS Fargate + GitHub Actions OIDC |

## ディレクトリ構成

```
.
├── apps/
│   ├── frontend/       # Next.js
│   └── backend/        # NestJS
├── infra/              # AWS CDK
├── docs/
│   ├── adr/            # アーキテクチャ設計判断
│   ├── architecture/   # システム全体構成
│   └── runbooks/       # 運用手順
└── .github/workflows/  # CI/CD
```

## ローカル環境構築

### 前提条件

- Docker / Docker Compose
- Google OAuth クライアント ID / シークレット
- OpenAI API キー

### 1. リポジトリのクローン

```bash
git clone https://github.com/jun-eg/credit-checker.git
cd credit-checker
```

### 2. 環境変数の設定

```bash
cp .env.example .env
```

`.env` を開き、以下の2つを外部サービスから取得して設定する：

| 変数 | 取得元 |
|------|--------|
| `AUTH_GOOGLE_ID` | Google Cloud Console → 認証情報 → OAuth 2.0 クライアント |
| `AUTH_GOOGLE_SECRET` | 同上 |
| `OPENAI_API_KEY` | OpenAI Platform → API keys |

`JWT_SECRET` / `AUTH_SECRET` はダミー値のままで動作するため変更不要。

### 3. 起動

```bash
npm run dev
```

初回は `setup.sh` が自動で実行され、`.env` の値から `secrets/` ファイルを生成してから Docker Compose が起動する。2回目以降は既存の `secrets/` をスキップしてそのまま起動する。

> `secrets/` は `.gitignore` に含まれており、リポジトリにはコミットされない。

| サービス   | URL                      |
| ---------- | ------------------------ |
| フロントエンド | http://localhost:3000 |
| バックエンド   | http://localhost:3003 |
| LocalStack     | http://localhost:4566 |

初回起動時はマイグレーションが自動実行される。

## 設定値の3分類

`.env.example` の構造と対応している。詳細は [ADR 003](docs/adr/003-secret-three-categories.md) を参照。

| 分類 | 具体例 | 管理方法 |
|------|--------|----------|
| 公開設定 | `NODE_ENV`, `AWS_REGION`, `AUTH_GOOGLE_ID` | `.env` / ECS environment |
| インフラ設定 | `POSTGRES_*`（ローカルのみ） | `.env`（本番は RDS 自動生成） |
| Strong Secret | `AUTH_SECRET`, `DATABASE_URL` 等 | `secrets/` ファイル / ECS `secrets:` フィールド |

## ドキュメント

- [アーキテクチャ概要](docs/architecture/overview.md)
- [ADR 一覧](docs/adr/)
- [初回セットアップ手順](docs/runbooks/initial-setup.md)
- [デプロイ手順](docs/runbooks/deploy.md)
- [ロールバック手順](docs/runbooks/rollback.md)
- [ECS Exec 手順](docs/runbooks/ecs-exec.md)
