import {
  GetReceiptDetailResponse,
  GetReceiptResponse,
  ListReceiptsResponse,
  MonthlySummaryResponse,
  UpdateReceiptRequest,
  YearlySummaryResponse,
  UploadReceiptResponse,
} from '../../types/receipt';

// SSR: BACKEND_URL（サーバー側env var）でバックエンドに直接通信
// クライアント: /api/v1 の相対パス（本番はALBが転送、ローカルはNext.js rewriteがプロキシ）
const backendUrl =
  typeof window === 'undefined'
    ? process.env.BACKEND_URL
    : '/api/v1';

export async function getReceipt(
  id: string,
  token: string,
): Promise<GetReceiptResponse> {
  const res = await fetch(`${backendUrl}/receipts/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`取得に失敗しました (${res.status}): ${text}`);
  }

  return res.json() as Promise<GetReceiptResponse>;
}

export async function getReceiptDetail(
  id: string,
  token: string,
): Promise<GetReceiptDetailResponse> {
  const res = await fetch(`${backendUrl}/receipts/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`取得に失敗しました (${res.status}): ${text}`);
  }

  return res.json() as Promise<GetReceiptDetailResponse>;
}

export async function listReceipts(token: string): Promise<ListReceiptsResponse> {
  const res = await fetch(`${backendUrl}/receipts`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`取得に失敗しました (${res.status}): ${text}`);
  }

  return res.json() as Promise<ListReceiptsResponse>;
}

export async function getMonthlySummary(
  token: string,
  year: number,
  month: number,
): Promise<MonthlySummaryResponse> {
  const res = await fetch(`${backendUrl}/receipts/summary?year=${year}&month=${month}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`取得に失敗しました (${res.status}): ${text}`);
  }

  return res.json() as Promise<MonthlySummaryResponse>;
}

export async function getYearlySummary(
  token: string,
  year: number,
): Promise<YearlySummaryResponse> {
  const res = await fetch(`${backendUrl}/receipts/yearly?year=${year}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`取得に失敗しました (${res.status}): ${text}`);
  }

  return res.json() as Promise<YearlySummaryResponse>;
}

export async function updateReceipt(
  id: string,
  token: string,
  data: UpdateReceiptRequest,
): Promise<GetReceiptResponse> {
  const res = await fetch(`${backendUrl}/receipts/${id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`更新に失敗しました (${res.status}): ${text}`);
  }

  return res.json() as Promise<GetReceiptResponse>;
}

export async function deleteReceipt(id: string, token: string): Promise<void> {
  const res = await fetch(`${backendUrl}/receipts/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`削除に失敗しました (${res.status}): ${text}`);
  }
}

export async function getReceiptImageUrl(id: string, token: string): Promise<string> {
  const res = await fetch(`${backendUrl}/receipts/${id}/image`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(`画像の取得に失敗しました (${res.status})`);
  }

  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export async function uploadReceipt(
  file: File,
  token: string,
): Promise<UploadReceiptResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${backendUrl}/receipts/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    // Content-TypeはFormDataのboundaryを含むためfetchに自動設定させる
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`アップロードに失敗しました (${res.status}): ${text}`);
  }

  return res.json() as Promise<UploadReceiptResponse>;
}
