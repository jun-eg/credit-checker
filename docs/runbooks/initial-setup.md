# 初回セットアップ手順

初回デプロイ時のみ必要な手順。2回目以降のデプロイでは不要。

## ローカル開発環境

```bash
cp .env.example .env
```

`.env` を編集し、アプリが使う外部サービスのシークレットを設定する。
設定が必要な変数は `.env.example` のコメントを参照。

`JWT_SECRET` / `AUTH_SECRET` はローカルでは固定のダミー値で動作するため変更不要。

```bash
./setup.sh
docker compose up
```

---

## AWS 環境（dev / prod）

通常のデプロイは GitHub Actions（workflow_dispatch または push）で行う。
以下は初回のみ必要な手順。

### 前提条件

`infra/.env.infra` の AWS 認証情報を設定する。
デプロイ対象（dev または prod）に応じてプロファイルを切り替えること。

```bash
# dev の場合
aws sso login --profile dev
aws configure export-credentials --profile dev --format env
# → 出力された AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_SESSION_TOKEN を .env.infra に貼り付ける

# prod の場合
aws sso login --profile prod
aws configure export-credentials --profile prod --format env
```

### 1. CDK bootstrap（各アカウントで1回のみ）

CDK がデプロイに使う S3 バケット・IAM ロールを作成する。

```bash
cd infra
npm ci

# dev（DEV_AWS_ACCOUNT_ID と AWS_REGION は .env.infra から取得）
npx cdk bootstrap aws://${DEV_AWS_ACCOUNT_ID}/${AWS_REGION}

# prod（.env.infra の認証情報を prod 用に差し替えてから実行）
npx cdk bootstrap aws://${PROD_AWS_ACCOUNT_ID}/${AWS_REGION}
```

### 2. Bootstrap stack deploy（各アカウントで1回のみ）

GitHub Actions OIDC プロバイダーとデプロイロールを作成する。

```bash
# dev
npx cdk deploy Bootstrap --require-approval never

# prod（.env.infra の認証情報と DEV_AWS_ACCOUNT_ID を prod 用に差し替えてから実行）
npx cdk deploy Bootstrap -c env=prod --require-approval never
```

### 3. GitHub Secrets / Variables の設定

GitHub → リポジトリ → **Settings → Secrets and variables → Actions**

**Secrets：**

| 名前 | 値 |
|------|-----|
| `DEV_AWS_ACCOUNT_ID` | dev AWS アカウント ID |
| `PROD_AWS_ACCOUNT_ID` | prod AWS アカウント ID |

**Variables：**

| 名前 | 値 |
|------|-----|
| `APP_NAME` | アプリ名（例: `myapp`）。S3・ECS リソース名のベースになる |
| `AWS_REGION` | デプロイリージョン（例: `ap-northeast-1`） |
| `AUTH_GOOGLE_ID` | 使用する OAuth プロバイダーのクライアント ID |

### 4. 初回デプロイ

GitHub Actions → **Deploy** → **Run workflow** から dev 環境に向けて実行する。

### 5. Secrets Manager を更新する

**この手順は ECS サービス起動前に必ず実施すること。**
`REPLACE_ME` のままでは起動後にアプリが正常動作しない。

```bash
# APP_NAME は .env.infra の値を使用（例: myapp）
aws secretsmanager update-secret \
  --secret-id "/${APP_NAME}/dev/app-secrets" \
  --secret-string '{
    "auth_google_secret": "<OAuth プロバイダーのシークレット>",
    "openai_api_key":     "<OpenAI API キー（使用する場合）>"
  }' \
  --region ${AWS_REGION} --profile dev
```

設定内容を確認する：

```bash
aws secretsmanager get-secret-value \
  --secret-id "/${APP_NAME}/dev/app-secrets" \
  --query SecretString --output text --profile dev | jq .
```

---

## 2回目以降のシークレット更新

値を変更したい場合は `docs/runbooks/secret-rotation.md` を参照。
