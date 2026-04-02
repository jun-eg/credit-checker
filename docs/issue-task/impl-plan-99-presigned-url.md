# Issue #99 修正実装計画：S3 Presigned URL移行

## Context

レシート詳細ページの画像読み込みが遅い問題（issue #99）を修正する。

**現在の画像取得経路**：
```
ブラウザ → ALB → NestJS → S3 → NestJS → ALB → ブラウザ  (プロキシ経由)
↑ さらに useEffect によるCSR追加往復も発生
```

**目指す経路**：
```
SSR時: NestJS → S3（presigned URL生成のみ）
      ↓ URLをHTMLに埋め込む
ブラウザ → S3 直接アクセス（NestJSプロキシ不要）
```

S3 Presigned URL 方式により、NestJSプロキシの排除・CSR往復の解消・Buffer全量メモリ収集の解消をまとめて達成する。

---

## 対象ファイル

| 変更種別 | ファイル |
|--------|---------|
| 追加 | `apps/backend/src/s3/s3.service.ts` |
| 追加 | `apps/backend/src/receipts/receipts.service.ts` |
| 追加 | `apps/backend/src/receipts/receipts.controller.ts` |
| 変更 | `apps/frontend/src/lib/api/receipts.ts` |
| 変更 | `apps/frontend/src/app/receipts/[id]/page.tsx` |
| 変更 | `apps/frontend/src/components/ReceiptDetailContent.tsx` |
| 変更 | `apps/backend/package.json` |
| 変更 | `.env`（ローカル開発用） |

---

## 実装手順

### Step 1: `@aws-sdk/s3-request-presigner` インストール

`apps/backend/package.json` に追加。`@aws-sdk/client-s3` と同じメジャーバージョン（現在 `^3.x`）を使用。

```bash
cd apps/backend && npm install @aws-sdk/s3-request-presigner
```

---

### Step 2: `S3Service.getPresignedUrl` 追加

**ファイル**: `apps/backend/src/s3/s3.service.ts`

`getSignedUrl`（`@aws-sdk/s3-request-presigner`）を使用し、`GetObjectCommand` に署名付きURLを生成する。

**ローカル開発の考慮点**：  
LocalStack の Presigned URL は Docker 内部ホスト名（`http://localstack:4566/...`）になりブラウザから到達不可。`S3_PUBLIC_ENDPOINT` 環境変数（設定時のみ有効）でホスト部分を書き換える。これは `S3_ENDPOINT`（内部通信用）と分離することでアプリコードに環境分岐を持ち込まない原則5に準拠。

```typescript
async getPresignedUrl(s3Key: string, expiresIn = 3600): Promise<string> {
  const command = new GetObjectCommand({ Bucket: this.bucket, Key: s3Key });
  const url = await getSignedUrl(this.client, command, { expiresIn });

  // Docker環境ではPresigned URLが内部ホスト名になるため、ブラウザアクセス可能なURLに書き換える
  const internalEndpoint = this.configService.get<string>('S3_ENDPOINT');
  const publicEndpoint = this.configService.get<string>('S3_PUBLIC_ENDPOINT');
  if (internalEndpoint && publicEndpoint) {
    return url.replace(internalEndpoint, publicEndpoint);
  }
  return url;
}
```

---

### Step 3: `ReceiptsService.getReceiptImagePresignedUrl` 追加

**ファイル**: `apps/backend/src/receipts/receipts.service.ts`

```typescript
async getReceiptImagePresignedUrl(receiptId: string, userId: string): Promise<string> {
  const receipt = await this.receiptsRepository.findOneBy({ id: receiptId, userId });
  if (!receipt) throw new NotFoundException(`レシートが見つかりません: ${receiptId}`);
  return this.s3Service.getPresignedUrl(receipt.s3Key);
}
```

---

### Step 4: `ReceiptsController` に `GET :id/image-url` 追加

**ファイル**: `apps/backend/src/receipts/receipts.controller.ts`

```typescript
@Get(':id/image-url')
async getReceiptImagePresignedUrl(
  @CurrentUser() user: User,
  @Param('id', ParseUUIDPipe) id: string,
): Promise<{ url: string }> {
  const url = await this.receiptsService.getReceiptImagePresignedUrl(id, user.id);
  return { url };
}
```

**注意**: `GET :id/image-url` は `GET :id` よりも前に定義する必要がある（NestJSのルート解決順序）。  
既存の `GET :id/image`（バイナリプロキシ）は**残す**。

---

### Step 5: `receipts.ts` API ラッパー修正

**ファイル**: `apps/frontend/src/lib/api/receipts.ts`

- 旧 `getReceiptImageUrl`（blob取得、クライアントサイド）を**削除**
- SSR用 `getReceiptImagePresignedUrl` を**追加**

```typescript
export async function getReceiptImagePresignedUrl(
  id: string,
  token: string,
): Promise<string> {
  const res = await fetch(`${backendUrl}/receipts/${id}/image-url`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(`画像URLの取得に失敗しました (${res.status})`);
  }

  const data = (await res.json()) as { url: string };
  return data.url;
}
```

---

### Step 6: `ReceiptDetailPage` 修正（SSRでURL取得）

**ファイル**: `apps/frontend/src/app/receipts/[id]/page.tsx`

```typescript
const [receipt, imageUrl] = await Promise.all([
  getReceiptDetail(id, session.backendToken).catch(() => notFound()),
  getReceiptImagePresignedUrl(id, session.backendToken).catch(() => null),
]);

// ...
<ReceiptDetailContent receipt={receipt} imageUrl={imageUrl ?? undefined} />
```

`token` prop は渡さない（クライアントサイドでの画像フェッチが不要になるため）。

---

### Step 7: `ReceiptDetailContent` 修正

**ファイル**: `apps/frontend/src/components/ReceiptDetailContent.tsx`

**削除するもの**：
- `ViewProps` の `token?: string`
- `getReceiptImageUrl` import
- `imageFetch` state と `imageFetchKey`、`imageStatus` の計算ロジック（L112-128）
- `useEffect` による画像フェッチ（L130-143）

**追加するもの**：
- `ViewProps` に `imageUrl?: string` prop

**変更後のイメージ**：
```typescript
interface ViewProps {
  receipt: GetReceiptDetailResponse;
  editMode?: false;
  imageUrl?: string;  // token の代わりにSSR生成済みURLを受け取る
}
```

レンダリング部分は `imageUrl` を直接使用：
```tsx
{imageUrl && (
  <div className="overflow-hidden rounded-2xl bg-white shadow-sm dark:bg-zinc-900">
    <button onClick={() => setIsImageModalOpen(true)} ...>
      <Image src={imageUrl} alt="レシート画像" width={800} height={1200} unoptimized ... />
    </button>
  </div>
)}
```

`loading` / `error` 状態はPresigned URL自体の取得失敗を `page.tsx` 側で `null` として処理するため、コンポーネント内のローディング表示は不要になる。

---

### Step 8: ローカル開発 `.env` に `S3_PUBLIC_ENDPOINT` 追加

```
S3_PUBLIC_ENDPOINT=http://localhost:4566
```

これは既存の `.env`（開発者のローカル）に追記する。LocalStack ポート `4566` はすでに `docker-compose.yml` で公開済み。

---

## スコープ外（別 Issue 推奨）

| 項目 | 理由 |
|-----|-----|
| アップロード時の画像圧縮（sharp） | 独立した改善でこのIssueと分離可能 |
| `next/image` の remotePatterns 設定 | S3ドメインが本番/ローカルで異なり設定が複雑。`unoptimized` のままで機能的には問題なし |
| Nginxキャッシュ | 優先度低。Presigned URL方式ではNestJS経由でないためnginx通過せず |
| 既存 `GET :id/image` エンドポイントの削除 | 廃止は別PRで行う |

---

## 検証方法

1. **ローカル起動**: `docker compose up` で全サービスを起動
2. **レシートアップロード**: ファイルをアップロードし解析完了を確認
3. **詳細ページ表示**: 画像が表示されることを確認（DevToolsのネットワークタブで `localhost:4566` への直接リクエストが飛ぶことを確認）
4. **SSR確認**: ページソースに `localhost:4566` のURLが含まれていることを確認
5. **エラーケース**: 存在しないIDでアクセスした場合に `notFound()` になることを確認
