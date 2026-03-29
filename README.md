# レシート管理アプリ

レシートの写真を保存・解析し、LLMとの対話形式で支出状況を確認できるWebアプリケーション。

## 機能

- レシート画像のアップロード・管理
- GPT-4o Vision による自動解析（店名・金額・商品明細・カテゴリ分類）
- チャット形式での支出照会（例：「今月の食費は？」「先月と比べてどう？」）
- 月次・カテゴリ別サマリー表示

## 技術スタック

| 領域           | 技術                        |
| -------------- | --------------------------- |
| フロントエンド | Next.js (App Router)        |
| バックエンド   | NestJS                      |
| データベース   | PostgreSQL                  |
| 画像ストレージ | AWS S3                      |
| 認証           | NextAuth.js（Google OAuth） |
| LLM            | OpenAI GPT-4o               |
| デプロイ       | AWS                         |

## ディレクトリ構成

```
.
├── frontend/   # Next.js
├── backend/    # NestJS
└── docs/       # 設計書
```

## 環境構築手順

### 前提条件

- Node.js 20+
- Docker / Docker Compose
- AWS アカウント（S3）
- OpenAI API キー
- Google OAuth クライアント ID / シークレット

### 1. リポジトリのクローン

```bash
git clone https://github.com/jun-eg/credit-checker.git
cd credit-checker
```

### 2. 環境変数の設定

```bash
cp .env.example .env
```

`.env` を編集して各値を設定する。

**ルート `.env`（Docker Compose 用）**

```env
POSTGRES_USER=credit_checker
POSTGRES_PASSWORD=your_password
POSTGRES_DB=credit_checker_db
DATABASE_URL=postgresql://credit_checker:your_password@localhost:5432/credit_checker_db
```

**`frontend/.env.local`（新規作成）**

```env
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_secret
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
BACKEND_URL=http://localhost:3003
```

**`backend/.env`（新規作成）**

```env
DATABASE_URL=postgresql://credit_checker:your_password@localhost:5432/credit_checker_db
AWS_REGION=ap-northeast-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
S3_BUCKET_NAME=your_bucket_name
OPENAI_API_KEY=your_openai_api_key
NEXTAUTH_SECRET=your_secret
```

### 3. データベースの起動

```bash
docker compose up -d
```

### 4. 依存パッケージのインストール

```bash
# ルートでまとめてインストール
npm install

# または個別に
cd frontend && npm install
cd ../backend && npm install
```

### 5. アプリケーションの起動

```bash
# フロントエンド（localhost:3000）
npm run dev:frontend

# バックエンド（localhost:3003）
npm run dev:backend
```

個別に起動する場合：

```bash
# フロントエンド
cd frontend && npm run dev

# バックエンド
cd backend && npm run start:dev
```

### 6. コード品質チェック

```bash
# 全体 Lint
npm run lint

# フォーマット
npm run format

# フロントエンド 型チェック
cd frontend && npm run type-check
```

## ドキュメント

- [設計書](docs/design.md)
