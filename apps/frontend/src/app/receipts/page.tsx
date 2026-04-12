import { auth } from '../../../auth';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { AppHeader } from '../../components/AppHeader';
import { ReceiptUploadCard } from '../dashboard/_components/ReceiptUploadCard';
import { ReceiptList } from './_components/ReceiptList';
import { listReceipts } from '../../lib/api/receipts';
import { listRoomReceipts } from '../../lib/api/rooms';
import { ListReceiptItem } from '../../types/receipt';
import { RoomReceiptItem } from '../../types/room';

// RoomReceiptItemはpossibleDuplicateIdsを持たないため、ReceiptListItemにマッピングして渡す
function toReceiptListItem(item: RoomReceiptItem): ListReceiptItem & { uploaderDisplayName?: string | null } {
  return {
    id: item.id,
    status: item.status,
    originalFileName: item.originalFileName,
    storeName: item.storeName,
    purchasedAt: item.purchasedAt,
    total: item.total,
    currency: item.currency,
    possibleDuplicateIds: null,
    categories: [],
    createdAt: item.createdAt,
    uploaderDisplayName: item.uploaderDisplayName,
  };
}

function parseRoomFromCookie(cookieValue: string): { id: string; name: string } | null {
  if (!cookieValue.startsWith('room:')) return null;
  const [, id, encodedName] = cookieValue.split(':');
  if (!id || !encodedName) return null;
  return { id, name: decodeURIComponent(encodedName) };
}

export default async function ReceiptsPage() {
  const session = await auth();

  if (!session) {
    redirect('/');
  }

  const cookieStore = await cookies();
  const modeCookieValue = cookieStore.get('app-mode')?.value ?? '';
  const currentRoom = parseRoomFromCookie(modeCookieValue);
  const roomId = currentRoom?.id ?? null;

  const receipts = await (roomId
    ? listRoomReceipts(roomId, session.backendToken)
        .then((items) => items.map(toReceiptListItem))
        .catch(() => [] as ReturnType<typeof toReceiptListItem>[])
    : listReceipts(session.backendToken)
        .then((data) => data.items)
        .catch(() => [] as ListReceiptItem[]));

  return (
    <div className="min-h-dvh bg-zinc-50 dark:bg-black">
      <AppHeader currentPath="/receipts" />

      <main className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-6 sm:py-10">
        <ReceiptUploadCard backendToken={session.backendToken} currentRoom={currentRoom} />

        <div className="rounded-2xl bg-white shadow-sm dark:bg-zinc-900">
          <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-4 sm:px-8 sm:py-5 dark:border-zinc-800">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              レシート一覧
            </h2>
            <Link
              href="/receipts/trash"
              className="flex items-center gap-1 text-xs text-zinc-400 transition-colors hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
              ゴミ箱
            </Link>
          </div>
          <ReceiptList
            receipts={receipts}
            backendToken={session.backendToken}
            showUploader={!!roomId}
          />
        </div>
      </main>
    </div>
  );
}
