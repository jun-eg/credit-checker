# ADR 001: Fargate を public subnet + public IP で配置する

## ステータス

採用

## コンテキスト

Fargate タスクがインターネットと通信する必要がある（ECR からのイメージ pull、Secrets Manager / CloudWatch Logs への API 呼び出し）。

通常、Fargate を private subnet に配置して NAT Gateway 経由でアウトバウンドを許可するパターンが多いが、NAT Gateway には固定コスト（$0.045/時間 ≒ $33/月）が発生する。

## 決定

Fargate タスクを **public subnet に配置し、public IP を付与** する。

## 理由

- NAT Gateway を採用すると月額 $33 超の固定費が発生し、dev 環境（夜間停止前提）のコスト目標に合わない
- public subnet + public IP でも、Security Group でインバウンドを ALB SG からのみに制限することで、インターネットから直接 Fargate にアクセスされるリスクは排除できる
- アウトバウンドは 443 (HTTPS) のみを明示的に許可（`allowAllOutbound: false`）し、意図しない通信を防いでいる

## トレードオフ

- Fargate に public IP が割り当たるため、SG 設定ミスが生じた場合の露出リスクが private subnet より高い
- 将来的にスループット増加やコンプライアンス要件が変わった場合は NAT Gateway への移行を検討する
