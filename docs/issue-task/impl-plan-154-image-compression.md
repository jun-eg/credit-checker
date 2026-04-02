# Issue #154 修正実装計画：アップロード時の画像WebP変換・リサイズ

## Context

Issue #99（Presigned URL移行）により画像はS3から直接配信されるようになり、S3のデータ転送コストが直接発生するようになった。現状は最大10MBの原寸画像をそのまま保存・配信しており、以下のコストが無駄に発生している。

- S3 ストレージコスト
- S3 → ブラウザ間のデータ転送コスト
- OpenAI Vision API のトークンコスト（画像サイズに比例）

アップロード時に `sharp` で一度だけ WebP 変換 + リサイズすることで、これらを削減する。

---

## 対象ファイル

| 変更種別 | ファイル |
|--------|---------|
| 変更 | `apps/backend/src/receipts/receipts.service.ts` |
| 変更 | `apps/backend/package.json` |

---

## 実装手順

### Step 1: `sharp` パッケージのインストール

```bash
cd apps/backend && npm install sharp && npm install --save-dev @types/sharp
```

### Step 2: `ReceiptsService` に `convertToWebP` プライベートメソッドを追加

**ファイル**: `apps/backend/src/receipts/receipts.service.ts`

```typescript
import sharp from 'sharp';

private async convertToWebP(
  buffer: Buffer,
): Promise<{ buffer: Buffer; mimeType: 'image/webp' }> {
  const converted = await sharp(buffer)
    .resize(1600, 1600, {
      fit: 'inside',           // 縦横比を保持・見切れなし
      withoutEnlargement: true, // 元画像より大きくしない
    })
    .webp({ quality: 85 })
    .toBuffer();
  return { buffer: converted, mimeType: 'image/webp' };
}
```

**設計の根拠**:
- `fit: 'inside'` でリサイズしても内容が欠けない
- `withoutEnlargement: true` で小さい画像を無駄に拡大しない
- `quality: 85` は文字認識に影響しない範囲で十分な圧縮
- 長辺 1600px はレシートのテキスト読み取りに十分な解像度

### Step 3: `uploadReceipt` メソッドを変更

**ファイル**: `apps/backend/src/receipts/receipts.service.ts`

変更前の処理（29-59行）：
```typescript
const ext = extname(file.originalname).toLowerCase();
const s3Key = `receipts/${userId}/${uuidv4()}${ext}`;
await this.s3Service.upload({ buffer: file.buffer, mimeType: file.mimetype, s3Key });
// ...
this.analyzeReceipt(saved.id, file.buffer, file.mimetype)
```

変更後：
```typescript
// アップロード前にWebP変換・リサイズ（S3コスト・転送コスト削減）
const { buffer: convertedBuffer, mimeType: convertedMimeType } =
  await this.convertToWebP(file.buffer);

const s3Key = `receipts/${userId}/${uuidv4()}.webp`;

await this.s3Service.upload({
  buffer: convertedBuffer,
  mimeType: convertedMimeType,
  s3Key,
});

// ...（DB保存は変更なし）

// 変換後バッファで解析（Vision APIのトークンコスト削減にもなる）
this.analyzeReceipt(saved.id, convertedBuffer, convertedMimeType).catch(...)
```

**ポイント**:
- `s3Key` の拡張子を `.webp` に固定（元の拡張子は不要）
- `analyzeReceipt` には変換後のバッファを渡す → Vision API コスト削減
- `path` モジュールの `extname` インポートが不要になる（削除）

---

## スコープ外

| 項目 | 理由 |
|-----|-----|
| `receipts.controller.ts` のバリデーション変更 | `ACCEPTED_MIME_TYPES` は受け入れフォーマット（ユーザー入力）なので変更不要 |
| `receipts.service.ts` の `getReceiptImage` | `.webp` は既に mimeType マッピングに対応済み（変更不要） |
| Dockerfile 変更 | `sharp` は Node.js 公式イメージ向けのプリビルドバイナリが同梱されており通常変更不要。CI/CD で問題が出た場合は別途対応 |

---

## 検証方法

1. レシート画像（JPEG/PNG）をアップロード
2. S3（LocalStack）に保存されたファイルの拡張子が `.webp` であることを確認
3. ファイルサイズが元より小さいことを確認（`aws s3api head-object` または LocalStack CLI）
4. レシート詳細ページで画像が正常に表示されることを確認
5. GPT-4o の解析結果（店名・金額・商品明細）が正常に取得できることを確認
