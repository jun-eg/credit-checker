import { auth } from '../../../auth';
import { redirect } from 'next/navigation';
import { AppHeader } from '../../components/AppHeader';
import { ReceiptUploadCard } from '../dashboard/_components/ReceiptUploadCard';
import { ReceiptList } from './_components/ReceiptList';
import { ReceiptTabs } from './_components/ReceiptTabs';
import { listReceipts } from '../../lib/api/receipts';
import { getRooms, listRoomReceipts } from '../../lib/api/rooms';
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
    createdAt: item.createdAt,
    uploaderDisplayName: item.uploaderDisplayName,
  };
}

interface ReceiptsPageProps {
  searchParams: Promise<{ roomId?: string }>;
}

export default async function ReceiptsPage({ searchParams }: ReceiptsPageProps) {
  const session = await auth();

  if (!session) {
    redirect('/');
  }

  const { roomId } = await searchParams;

  const [rooms, receipts] = await Promise.all([
    getRooms(session.backendToken).catch(() => []),
    roomId
      ? listRoomReceipts(roomId, session.backendToken)
          .then((items) => items.map(toReceiptListItem))
          .catch(() => [] as ReturnType<typeof toReceiptListItem>[])
      : listReceipts(session.backendToken)
          .then((data) => data.items)
          .catch(() => [] as ListReceiptItem[]),
  ]);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <AppHeader currentPath="/receipts" />

      <main className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-6 sm:py-10">
        <ReceiptTabs rooms={rooms} currentRoomId={roomId ?? null} />

        <ReceiptUploadCard backendToken={session.backendToken} rooms={rooms} />

        <div className="rounded-2xl bg-white shadow-sm dark:bg-zinc-900">
          <div className="border-b border-zinc-100 px-4 py-4 sm:px-8 sm:py-5 dark:border-zinc-800">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              レシート一覧
            </h2>
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
