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
  roomId?: string,
): Promise<MonthlySummaryResponse> {
  const params = new URLSearchParams({ year: String(year), month: String(month) });
  if (roomId) params.set('roomId', roomId);
  const res = await fetch(`${backendUrl}/receipts/summary?${params}`, {
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
  roomId?: string,
): Promise<YearlySummaryResponse> {
  const params = new URLSearchParams({ year: String(year) });
  if (roomId) params.set('roomId', roomId);
  const res = await fetch(`${backendUrl}/receipts/yearly?${params}`, {
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

export async function getTrashReceipts(token: string): Promise<ListReceiptsResponse> {
  const res = await fetch(`${backendUrl}/receipts/trash`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`取得に失敗しました (${res.status}): ${text}`);
  }

  return res.json() as Promise<ListReceiptsResponse>;
}

export async function restoreReceipt(id: string, token: string): Promise<void> {
  const res = await fetch(`${backendUrl}/receipts/${id}/restore`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`復元に失敗しました (${res.status}): ${text}`);
  }
}

export async function permanentDeleteReceipt(id: string, token: string): Promise<void> {
  const res = await fetch(`${backendUrl}/receipts/${id}/permanent`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`完全削除に失敗しました (${res.status}): ${text}`);
  }
}

export async function getReceiptImagePresignedUrl(id: string, token: string): Promise<string> {
  const res = await fetch(`${backendUrl}/receipts/${id}/image-url`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(`画像URLの取得に失敗しました (${res.status})`);
  }

  const data = (await res.json()) as { url: string };
  return data.url;
}

export async function uploadReceipt(
  file: File,
  token: string,
  roomId?: string,
): Promise<UploadReceiptResponse> {
  const formData = new FormData();
  formData.append('file', file);
  // ルームへの投稿時のみroomIdを付与し、個人レシートとして区別する
  if (roomId) {
    formData.append('roomId', roomId);
  }

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
