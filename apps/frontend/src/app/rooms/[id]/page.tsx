import { notFound, redirect } from 'next/navigation';
import { auth } from '../../../../auth';
import { AppHeader } from '../../../components/AppHeader';
import { getRoom } from '../../../lib/api/rooms';
import { InvitationLinkPanel } from './_components/InvitationLinkPanel';
import { InviteCodeDisplay } from './_components/InviteCodeDisplay';
import { RoomActions } from './_components/RoomActions';

interface RoomDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function RoomDetailPage({ params }: RoomDetailPageProps) {
  const session = await auth();

  if (!session) {
    redirect('/');
  }

  const { id } = await params;

  const room = await getRoom(id, session.backendToken).catch(() => null);
  if (!room) notFound();

  // backendTokenのJWTペイロードからバックエンドユーザーIDを取得する
  const jwtPayload = JSON.parse(
    Buffer.from(session.backendToken.split('.')[1], 'base64url').toString(),
  ) as { sub: string };
  const isOwner = room.ownerId === jwtPayload.sub;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <AppHeader currentPath={`/rooms/${id}`} />
      <main className="mx-auto max-w-4xl space-y-6 px-4 py-6">

        {/* ルーム情報 */}
        <div className="rounded-2xl bg-white shadow-sm dark:bg-zinc-900">
          <div className="border-b border-zinc-100 px-4 py-4 sm:px-8 sm:py-5 dark:border-zinc-800">
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {room.name}
            </h1>
          </div>

          {/* メンバー一覧 */}
          <div className="border-b border-zinc-100 px-4 py-4 sm:px-8 dark:border-zinc-800">
            <h2 className="mb-3 text-sm font-medium text-zinc-500 dark:text-zinc-400">
              メンバー ({room.members.length}人)
            </h2>
            <ul className="space-y-2">
              {room.members.map((member) => (
                <li key={member.id} className="flex items-center gap-2">
                  <span className="text-sm text-zinc-900 dark:text-zinc-50">
                    {member.displayName ?? member.userId}
                  </span>
                  {member.role === 'owner' && (
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                      オーナー
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* 招待コード（オーナーのみ） */}
          {isOwner && room.inviteCode && room.inviteCodeExpiresAt && (
            <div className="border-b border-zinc-100 px-4 py-4 sm:px-8 dark:border-zinc-800">
              <h2 className="mb-2 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                招待コード
              </h2>
              <InviteCodeDisplay
                inviteCode={room.inviteCode}
                inviteCodeExpiresAt={room.inviteCodeExpiresAt}
                roomId={room.id}
                backendToken={session.backendToken}
              />
            </div>
          )}

          {/* 期限付き招待リンク（オーナーのみ） */}
          {isOwner && (
            <div className="border-b border-zinc-100 px-4 py-4 sm:px-8 dark:border-zinc-800">
              <h2 className="mb-2 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                招待リンク（期限付き）
              </h2>
              <InvitationLinkPanel roomId={room.id} backendToken={session.backendToken} />
            </div>
          )}

          {/* 退出・削除 */}
          <div className="px-4 py-4 sm:px-8">
            <RoomActions
              roomId={room.id}
              isOwner={isOwner}
              backendToken={session.backendToken}
            />
          </div>
        </div>

      </main>
    </div>
  );
}
