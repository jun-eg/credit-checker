import {
  GetReceiptDetailResponse,
  GetReceiptResponse,
  ListReceiptsResponse,
  MonthlySummaryResponse,
  UploadReceiptResponse,
} from '../../types/receipt';

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3003';

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
