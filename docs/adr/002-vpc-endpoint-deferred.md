# ADR 002: VPC Interface Endpoint を将来に先送りする

## ステータス

採用（先送り）

## コンテキスト

Fargate が ECR、Secrets Manager、CloudWatch Logs などの AWS サービスに接続する際、パブリックインターネット経由となる（`allowAllOutbound: false` で HTTPS(443) のみ許可）。

VPC Interface Endpoint を作成することでトラフィックを AWS バックボーンに閉じられるが、エンドポイントごとに料金が発生する（$0.01/時間/AZ = ~$7/月/AZ）。

## 決定

VPC Interface Endpoint の導入を **現時点では見送り**、将来の要件に応じて追加する。

## 理由

- S3 Gateway Endpoint（無料）は既に導入済み
- Interface Endpoint は ECR (ecr.api, ecr.dkr)、Secrets Manager、CloudWatch Logs の 3 サービス × AZ 数で固定費が膨らむ
- 現フェーズではコンプライアンス要件として「AWS ネットワーク外にトラフィックを出さない」は必須でない
- Fargate の public IP + 443 アウトバウンドで十分な運用が見込める

## 将来の再検討タイミング

- セキュリティ監査でインターネット経由の AWS API 呼び出しが問題となった場合
- 通信量増加により Interface Endpoint の方がコスト効率が良くなった場合
