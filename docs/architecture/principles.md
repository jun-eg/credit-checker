# 設計原則

このプロジェクトのインフラ・アーキテクチャ判断の軸をまとめたドキュメント。
個別の決断の記録は `docs/adr/` を参照。

---

## 1. prod-shaped dev-sized

**dev 環境は本番の縮小版であり、別物ではない。**

構成の形（スタック構成・SG ルール・デプロイフロー・Secret 注入方式）は dev と prod で同一にする。
変えるのはサイズだけ。

| 項目 | dev | prod |
|------|-----|------|
| ECS desiredCount | 0（夜間停止） | 1 |
| RDS | Single-AZ | Multi-AZ |
| VPC | maxAzs: 1 | maxAzs: 2 |
| スケーリング | min:0 / max:2 | min:1 / max:3 |

dev で「動いた」が prod で「動かない」という事態を構成の乖離から生じさせない。
テスト・検証も prod と同じ経路を通すことで、デプロイの信頼性を担保する。

---

## 2. コストとシンプルさを優先する

**追加コストと追加複雑性は、明確な必要性が生じるまで取り込まない。**

このプロジェクトは個人開発・小規模運用を前提とする。
セキュリティ上許容できる範囲で、コストと複雑性を最小に保つ。

具体的な判断例：

- **NAT Gateway を使わない**（月 $33 超）→ Fargate を public subnet + public IP で配置し、SG でインバウンドを ALB のみに制限（ADR 001）
- **VPC Interface Endpoint を先送り**（ECR / Secrets Manager / CloudWatch Logs 各エンドポイントで月数千円）→ S3 Gateway Endpoint（無料）のみ導入済み（ADR 002）
- **sidecar パターンを廃止**→ ECS `secrets:` フィールドが同等のセキュリティ特性を持ちつつ、実装コストがゼロ（ADR 003）

将来、スループット増・コンプライアンス要件・チーム規模が変われば再評価する。

---

## 3. スタックを責務で分割する

**インフラは Network / Data / App / Edge の 4 層で構成し、依存は一方向に流れる。**

```
NetworkStack → DataStack → AppStack → EdgeStack
```

| スタック | 責務 | 他スタックへの提供 |
|---------|------|--------------------|
| NetworkStack | VPC・サブネット・Security Group | vpc, albSg, fargateSg, rdsSg |
| DataStack | RDS・Secrets Manager・S3 | appSecret, appBucket |
| AppStack | ECR・ECS Cluster・TaskDef・Service | frontendService, backendService |
| EdgeStack | ACM・ALB・CloudFront・Route53 | （出力のみ） |

Security Group の所有はそれを「定義する責務があるスタック」に集約する。
NetworkStack が SG を所有し、利用するスタック（DataStack / AppStack）に渡す。
これにより循環依存を排除し、スタック間の依存関係を明示的に保つ。

---

## 4. Secret を機密度で 3 分類する

**回避すべきは `environment:` への平文記述であり、環境変数という仕組みそのものではない。**

| 分類 | 具体例 | 管理方法 |
|------|--------|----------|
| 公開設定 | `NODE_ENV`, `AWS_REGION`, `AUTH_GOOGLE_ID`, `FRONTEND_URL` | ECS `environment:` に平文 |
| インフラ設定 | `POSTGRES_USER`, `POSTGRES_PASSWORD`（ローカルのみ） | `.env` で管理 |
| Strong Secret | `AUTH_SECRET`, `AUTH_GOOGLE_SECRET`, `DATABASE_URL`, `JWT_SECRET`, `OPENAI_API_KEY` | Secrets Manager → ECS `secrets:` フィールドで環境変数注入 |

ECS `secrets:` フィールドを使うことで、値はタスク定義 JSON・CloudFormation テンプレート・CDK 出力に残らない。
`environment:` 平文との違いはここにある。

詳細は ADR 003 を参照。

---

## 5. アプリコードに環境差異を持ち込まない

**ローカル・dev・prod の差異はインフラ層で吸収し、アプリコードは環境を意識しない。**

Secret の読み込み方式を例に取ると：

- **ECS（dev / prod）**: `secrets:` フィールドにより `DATABASE_URL` 等が環境変数として注入済み
- **ローカル（docker compose）**: `entrypoint` でファイル（`/run/secrets/`）を読んで環境変数に変換してから起動

アプリコード（`secrets.ts`）は `process.env.DATABASE_URL` を読むだけ。
環境名（`NODE_ENV` 等）による分岐はない。

この原則は 12-factor app の思想と整合する。

- **Factor III（設定）**: 設定は環境変数として渡す。コードに環境名をハードコードしない
- **Factor IV（バッキングサービス）**: ローカルの LocalStack も本番の AWS S3 も「アタッチ可能な S3 互換リソース」として扱う。URL（`S3_ENDPOINT`）が設定されていれば向き先を変えるだけであり、アプリが環境を判定しているわけではない

`S3_ENDPOINT` の有無による `S3Client` の向き先切り替えはこの思想の正しい適用であり、環境差異の混入ではない。
フレームワーク・SDK（Next Auth v5 / Prisma / OpenAI SDK）が環境変数を前提としている事実とも一致する。

### 許容例外：`next.config.ts` の rewrites

ローカルには ALB が存在しないため、Next.js の `rewrites()` でバックエンドへのプロキシを設定している。
ECS では ALB のリスナールールが同じルーティングを担うため rewrites は無効にしている。

```
ローカル: ブラウザ → Next.js rewrites → backend（port 3003）
ECS:     ブラウザ → ALB → backend サービス
```

この構成差異は原則2（コストとシンプルさを優先）との兼ね合いで許容する。
ローカルに nginx を導入すれば原則5を完全に満たせるが、個人開発規模では過剰な複雑性となる。

---

## 6. デプロイは安全に、失敗は自動で戻す

**デプロイは migration → service 更新 → 安定確認の順序を守り、失敗時は自動でロールバックする。**

```
① Docker build & push → ECR
② migration task 実行（完了・成功を待機）
③ ECS Service 更新（新しいタスク定義ARNを --task-definition で指定）
④ services-stable 待機
⑤ 失敗時 → 前リビジョンへ自動 rollback
```

migration を先行実行することで、アプリの更新前にスキーマ変更を確定させる。
`services-stable` を待つことで、ヘルスチェック失敗を検知してから rollback できる。
これにより、不完全なデプロイが本番に残り続けるリスクを排除する。

CDK インフラのロールバック戦略（対象スタックの選択根拠を含む）は `docs/runbooks/rollback.md` を参照。
