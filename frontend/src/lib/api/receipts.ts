import { GetReceiptResponse, UploadReceiptResponse } from '../../types/receipt';

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
