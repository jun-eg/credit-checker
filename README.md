# レシート管理アプリ

レシートの写真を保存・解析し、LLMとの対話形式で支出状況を確認できるWebアプリケーション。

## 機能

- レシート画像のアップロード・管理
- GPT-4o Vision による自動解析（店名・金額・商品明細・カテゴリ分類）
- チャット形式での支出照会（例：「今月の食費は？」「先月と比べてどう？」）
- 月次・カテゴリ別サマリー表示

## 技術スタック

| 領域 | 技術 |
|------|------|
| フロントエンド | Next.js (App Router) |
| バックエンド | NestJS |
| データベース | PostgreSQL |
| 画像ストレージ | AWS S3 |
| 認証 | NextAuth.js（Google OAuth） |
| LLM | OpenAI GPT-4o |
| デプロイ | AWS |

## ディレクトリ構成

```
.
├── frontend/   # Next.js
├── backend/    # NestJS
└── docs/       # 設計書
```

## セットアップ

### 必要なもの

- Node.js 20+
- PostgreSQL
- AWS アカウント（S3）
- OpenAI API キー
- Google OAuth クライアント ID / シークレット

### 環境変数

**frontend/.env.local**

```env
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_secret
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
NEXT_PUBLIC_API_URL=http://localhost:4000
```

**backend/.env**

```env
DATABASE_URL=postgresql://user:password@localhost:5432/receipt_app
AWS_REGION=ap-northeast-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
S3_BUCKET_NAME=your_bucket_name
OPENAI_API_KEY=your_openai_api_key
NEXTAUTH_SECRET=your_secret
```

### 起動

```bash
# フロントエンド
cd frontend
npm install
npm run dev

# バックエンド
cd backend
npm install
npm run start:dev
```

## ドキュメント

- [設計書](docs/design.md)
