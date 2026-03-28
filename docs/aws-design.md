# AWS インフラ設計書

## アーキテクチャ全体図

```
Internet
    ↓
[Route53] → ドメイン管理
    ↓
[EC2] t3.small
    └── nginx (80/443)
          ├── /api/v1/* → NestJS container (:3003)
          └── /*        → Next.js container (:3000)  ← NextAuth の /api/auth/* も含む
    ↓                    ↓
[RDS] PostgreSQL    [S3] レシート画像
(Private Subnet)
```

> ALBは使用しない。nginx + Certbot (Let's Encrypt) でSSL終端。

### nginx ルーティング設定

NestJS のグローバルプレフィックスを `/api/v1` にすることで、NextAuth.js が使用する `/api/auth/*` と名前空間が分離される。

> **EC2 セットアップ時の注意**: EC2 上の `.env` で以下を設定すること。
> `BACKEND_URL` はコンテナ内からの接続のため Docker サービス名 `backend` を使用する（`localhost` はコンテナ自身を指すため不可）。
> ```
> BACKEND_URL=http://backend:3003/api/v1
> NEXT_PUBLIC_BACKEND_URL=https://<ドメイン>/api/v1
> ```

```nginx
# NestJS API
location /api/v1/ {
    proxy_pass http://localhost:3003;
}

# Next.js（NextAuth の /api/auth/* を含むすべてのルート）
location / {
    proxy_pass http://localhost:3000;
}
```

---

## AWSサービス一覧

| サービス | 用途 | スペック |
|---|---|---|
| EC2 | Next.js + NestJS 実行 | t3.small (2vCPU/2GB) |
| ECR | Docker イメージ管理 | frontend / backend の2リポジトリ |
| RDS | PostgreSQL | db.t3.micro, Private Subnet |
| S3 | レシート画像保存 | 既存バケット流用 |
| VPC | ネットワーク分離 | Public/Private サブネット |
| Route53 | DNS レコード管理 | A レコード → EC2 |

---

## ネットワーク設計（VPC）

```
VPC: 10.0.0.0/16
├── Public Subnet  10.0.1.0/24  (ap-northeast-1a) → EC2
└── Private Subnet 10.0.2.0/24  (ap-northeast-1a) → RDS

Security Groups:
├── sg-ec2:  inbound 80/443 (0.0.0.0/0), 22 (自分のIPのみ)
└── sg-rds:  inbound 5432 (sg-ec2 のみ)
```

---

## docker-compose（本番用）

```yaml
services:
  frontend:
    image: <ECR>/credit-checker-frontend:latest
    restart: always
    environment:
      - NEXTAUTH_URL=${NEXTAUTH_URL}
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
      - GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
      - GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
      - NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

  backend:
    image: <ECR>/credit-checker-backend:latest
    restart: always
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - AWS_S3_BUCKET=${S3_BUCKET_NAME}
      - FRONTEND_URL=${FRONTEND_URL}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
```

> `postgres` / `localstack` は本番では不要（RDS・本物S3を使用）

---

## CI/CD パイプライン（GitHub Actions）

```
push to main
    ↓
① AWS 認証 (OIDC)
② ECR ログイン
③ frontend Docker ビルド → ECR プッシュ  ┐ 並列実行
④ backend Docker ビルド → ECR プッシュ   ┘
    ↓
⑤ EC2 に SSH
⑥ docker compose pull
⑦ docker compose up -d
```

---

## 必要な実装変更

| ファイル | 変更内容 |
|---|---|
| `frontend/next.config.ts` | `output: 'standalone'` を追加 |
| `frontend/Dockerfile` | マルチステージビルドで新規作成 |
| `backend/Dockerfile` | 新規作成 |
| `docker-compose.prod.yml` | 本番用 compose ファイルを新規作成 |
| `.github/workflows/deploy.yml` | CI/CD パイプラインを新規作成 |

---

## コスト概算（月額）

| サービス | 費用 |
|---|---|
| EC2 t3.small | ~$15 |
| RDS db.t3.micro | ~$19 |
| S3 | ~$1 |
| ECR | ~$1 |
| Route53 | ~$1 |
| **合計** | **~$37/月（約5,500円）** |
