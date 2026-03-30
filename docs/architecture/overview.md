# システムアーキテクチャ概要

## システム全体構成図

```mermaid
graph TB
    User([ユーザー])
    CF[CloudFront]
    ALB[Application Load Balancer]
    FE[Frontend ECS Fargate]
    BE[Backend ECS Fargate]
    RDS[(PostgreSQL RDS)]
    SM[Secrets Manager]
    ECR[Amazon ECR]
    S3[Amazon S3]

    User --> CF
    CF --> ALB
    ALB -->|"/*"| FE
    ALB -->|"/api/*"| BE
    FE --> BE
    BE --> RDS
    BE --> S3
    SM -->|sidecar| FE
    SM -->|sidecar| BE
    ECR --> FE
    ECR --> BE
```

## リクエストの流れ

```
ユーザー
  → CloudFront（HTTPS / CDN キャッシュ）
  → ALB（HTTP→HTTPS リダイレクト）
    → /api/* → Backend ECS Service (port 3003)
    → /*     → Frontend ECS Service (port 3000)
  → Backend → RDS PostgreSQL（private subnet）
  → Backend → S3（via Gateway Endpoint）
```

## Secret の流れ

```
AWS Secrets Manager
  └─ /credit-checker/{env}/app-secrets
        ↓ sidecar コンテナが取得
  /run/secrets/jwt_secret
  /run/secrets/auth_secret
  /run/secrets/auth_google_secret
  /run/secrets/openai_api_key
  /run/secrets/database_url
        ↓ shared volume 経由
  main コンテナが /run/secrets/ から読み込む
```

## Deploy の流れ

```
GitHub Push (develop → dev / main → prod)
  → GitHub Actions (deploy.yml)
    1. detect-changes: infra / apps どちらに変更があるか検知
    2. deploy-infra: infra/ 変更時のみ CDK deploy
    3. deploy-app: apps/ 変更時
        a. Docker build & push → ECR
        b. migration task 実行（完了待機）
        c. ECS Service 更新（force-new-deployment）
        d. services-stable 待機
        e. 失敗時は前リビジョンへ自動 rollback
```

## VPC / サブネット構成

```mermaid
graph TB
    subgraph VPC["VPC (10.0.0.0/16)"]
        subgraph Public["Public Subnets"]
            ALB2[ALB]
            FE2[Frontend Fargate]
            BE2[Backend Fargate]
        end
        subgraph Private["Private Subnets"]
            RDS2[(RDS PostgreSQL)]
        end
    end
    Internet([Internet]) --> ALB2
    ALB2 --> FE2
    ALB2 --> BE2
    FE2 -->|5432| RDS2
    BE2 -->|5432| RDS2
```

## 環境一覧

| 環境 | AWS アカウント | ドメイン | スケーリング |
|------|--------------|----------|-------------|
| dev | credit-checker-dev | dev.jun-eg.site | min:0 / max:2（夜間停止） |
| prod | credit-checker-prod | jun-eg.site | min:1 / max:3 |
