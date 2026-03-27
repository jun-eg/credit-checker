# レシート管理アプリ 設計書

## 1. アプリ概要

レシートの写真を保存・解析し、LLMとの対話形式で支出状況を確認できるWebアプリケーション。

### 主な機能

- レシート画像のアップロード・管理
- GPT-4o Visionによる自動解析（店名・金額・商品明細・カテゴリ分類）
- チャット形式での支出照会（例：「今月の食費は？」「先月と比べてどう？」）
- 月次・カテゴリ別サマリー表示

---

## 2. 技術スタック

| 領域 | 技術 |
|------|------|
| フロントエンド | Next.js (App Router) |
| バックエンド | NestJS |
| データベース | PostgreSQL |
| 画像ストレージ | AWS S3 |
| 認証 | NextAuth.js（Google OAuth） |
| LLM | OpenAI GPT-4o |
| デプロイ | AWS |

---

## 3. システムアーキテクチャ

```
[ブラウザ]
    │
    ├─ Next.js (フロントエンド + NextAuth.js)
    │       │
    │       └─ NestJS API サーバー
    │               ├─ PostgreSQL（構造化データ）
    │               ├─ AWS S3（画像ファイル）
    │               └─ OpenAI API（解析・チャット）
    │
    └─ Google OAuth（認証）
```

---

## 4. データベーススキーマ

### users
NextAuth.js の標準テーブル構成に準拠。

```sql
CREATE TABLE users (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT UNIQUE NOT NULL,
  name       TEXT,
  image      TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### receipts
```sql
CREATE TABLE receipts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  s3_key       TEXT NOT NULL,          -- S3上の画像パス
  store_name   TEXT,                   -- 店名
  purchased_at DATE NOT NULL,          -- 購入日
  total_amount INTEGER NOT NULL,       -- 合計金額（円）
  category     TEXT NOT NULL,          -- カテゴリ（固定リスト）
  created_at   TIMESTAMP DEFAULT NOW()
);
```

### receipt_items
```sql
CREATE TABLE receipt_items (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id UUID NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,    -- 商品名
  price      INTEGER NOT NULL, -- 金額（円）
  quantity   INTEGER NOT NULL DEFAULT 1
);
```

### chat_sessions
```sql
CREATE TABLE chat_sessions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### chat_messages
```sql
CREATE TABLE chat_messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content    TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 5. カテゴリ固定リスト

```
食費 / 外食 / 日用品 / 交通費 / 医療費 / 衣類 / 娯楽 / その他
```

---

## 6. レシート解析フロー

```
1. ユーザーが画像をアップロード
2. NestJS が S3 に画像を保存（s3_key を取得）
3. S3 の画像URLを GPT-4o Vision に投げる
4. GPT-4o が以下を返す（JSON）:
   {
     store_name: "セブンイレブン 渋谷店",
     purchased_at: "2026-03-27",
     total_amount: 1250,
     category: "食費",
     items: [
       { name: "おにぎり 鮭", price: 150, quantity: 1 },
       { name: "お茶 500ml", price: 100, quantity: 2 },
       ...
     ]
   }
5. receipts テーブルに1レコード挿入
6. receipt_items テーブルに明細レコードを挿入
7. フロントに解析結果を返す
```

### GPT-4o へのシステムプロンプト（解析時）

```
あなたはレシートを解析するアシスタントです。
画像からレシートの情報を読み取り、以下のJSON形式で返してください。
金額はすべて円（整数）で返してください。
カテゴリは以下から最も適切なものを1つ選んでください：
食費, 外食, 日用品, 交通費, 医療費, 衣類, 娯楽, その他

{
  "store_name": "店名",
  "purchased_at": "YYYY-MM-DD",
  "total_amount": 合計金額(整数),
  "category": "カテゴリ",
  "items": [
    { "name": "商品名", "price": 金額(整数), "quantity": 数量(整数) }
  ]
}
```

---

## 7. チャット機能

### Tool Calling 関数一覧

| 関数名 | 引数 | 内容 |
|--------|------|------|
| `get_total_spending` | `from: Date, to: Date` | 期間内の合計金額 |
| `get_spending_by_category` | `from: Date, to: Date` | カテゴリ別の合計金額 |
| `get_receipts` | `from: Date, to: Date, category?: string` | レシート一覧 |
| `get_monthly_summary` | `year: number, month: number` | 月次サマリー |

### チャットフロー

```
1. ユーザーがメッセージを送信
2. chat_messages に role=user で保存
3. セッションの全履歴 + Tool定義を OpenAI に送信
4. OpenAI が Tool Calling を実行（必要に応じて）
5. NestJS が DB からデータを取得し結果を返す
6. OpenAI が最終回答を生成
7. chat_messages に role=assistant で保存
8. フロントにレスポンスを返す
```

---

## 8. APIエンドポイント（NestJS）

すべてのエンドポイントは認証必須（JWTトークン検証）。

### レシート

| メソッド | パス | 内容 |
|---------|------|------|
| POST | `/receipts/upload` | 画像アップロード → GPT解析 → DB保存 |
| GET | `/receipts` | レシート一覧（クエリ: `from`, `to`, `category`） |
| GET | `/receipts/:id` | レシート詳細 + 明細 |
| DELETE | `/receipts/:id` | レシート削除（S3からも削除） |

### チャット

| メソッド | パス | 内容 |
|---------|------|------|
| POST | `/chat/sessions` | チャットセッション新規作成 |
| GET | `/chat/sessions` | セッション一覧 |
| GET | `/chat/sessions/:id` | セッション詳細（メッセージ含む） |
| POST | `/chat/sessions/:id/messages` | メッセージ送信 → LLM応答 |

---

## 9. 画面構成（Next.js）

| パス | 画面 | 内容 |
|------|------|------|
| `/` | トップ | ログインボタン |
| `/dashboard` | ダッシュボード | 当月サマリー・カテゴリ別グラフ |
| `/receipts` | レシート一覧 | 一覧表示・アップロードボタン |
| `/receipts/[id]` | レシート詳細 | 画像・明細・編集 |
| `/chat` | チャット | チャット画面（セッション管理） |

---

## 10. 認証フロー（NextAuth.js）

```
1. ユーザーが「Googleでログイン」をクリック
2. Google OAuth で認証
3. NextAuth.js がセッションを生成・Cookie に保存
4. Next.js から NestJS へのリクエスト時に JWT を付与
5. NestJS の Guard で JWT を検証し user_id を取得
```

---

## 11. AWS構成（案）

| サービス | 用途 |
|---------|------|
| ECS (Fargate) | NestJS APIサーバー |
| Amplify / Vercel | Next.js フロントエンド |
| RDS (PostgreSQL) | データベース |
| S3 | レシート画像保存 |
| ALB | ロードバランサー |
| ACM | SSL証明書 |
| ECR | Dockerイメージ管理 |
