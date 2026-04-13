'use client';

import { FormEvent, KeyboardEvent, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createChatSession, sendChatMessage } from '../../../lib/api/chat';
import { ChatMessageItem } from '../../../types/chat';

type NewChatState =
  | { status: 'idle' }
  | { status: 'sending'; userMessage: ChatMessageItem }
  | { status: 'error'; userMessage: ChatMessageItem; message: string };

interface NewChatThreadProps {
  backendToken: string;
  onMessageSent?: () => void;
}

export function NewChatThread({ backendToken, onMessageSent }: NewChatThreadProps) {
  const [state, setState] = useState<NewChatState>({ status: 'idle' });
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || state.status === 'sending') return;

    const userMessage: ChatMessageItem = {
      id: `optimistic-${Date.now()}`,
      role: 'user',
      content: trimmed,
      createdAt: new Date().toISOString(),
    };

    setState({ status: 'sending', userMessage });
    setInput('');

    try {
      const session = await createChatSession(backendToken);
      await sendChatMessage(session.id, trimmed, backendToken);
      onMessageSent?.();
      router.push(`/chat?session=${session.id}`);
    } catch (error) {
      setState({
        status: 'error',
        userMessage,
        message: error instanceof Error ? error.message : 'メッセージの送信に失敗しました',
      });
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as FormEvent);
    }
  };

  const isSending = state.status === 'sending';

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-8">
        {state.status === 'idle' && (
          <p className="text-center text-sm text-zinc-400 dark:text-zinc-500">
            質問を入力してください（例:「今月の食費を教えて」）
          </p>
        )}
        {(state.status === 'sending' || state.status === 'error') && (
          <>
            <div className="mb-4 flex justify-end">
              <div className="max-w-[75%] rounded-2xl bg-zinc-900 px-4 py-2 text-sm whitespace-pre-wrap text-white dark:bg-zinc-50 dark:text-zinc-900">
                {state.userMessage.content}
              </div>
            </div>
            {state.status === 'sending' && (
              <div className="mb-4 flex justify-start">
                <div className="rounded-2xl bg-zinc-100 px-4 py-2 text-sm text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500">
                  回答を生成中...
                </div>
              </div>
            )}
            {state.status === 'error' && (
              <div className="flex flex-col items-center gap-3">
                <p className="text-sm text-red-600 dark:text-red-400">{state.message}</p>
                <button
                  onClick={() => setState({ status: 'idle' })}
                  className="text-sm text-zinc-500 underline hover:text-zinc-700 dark:hover:text-zinc-300"
                >
                  やり直す
                </button>
              </div>
            )}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex items-end gap-3 border-t border-zinc-200 px-4 py-4 sm:px-6 dark:border-zinc-800"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isSending}
          placeholder="メッセージを入力..."
          rows={1}
          className="flex-1 resize-none rounded-xl border border-zinc-300 bg-transparent px-4 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-50 dark:placeholder-zinc-600 dark:focus:border-zinc-500"
        />
        <button
          type="submit"
          disabled={isSending || !input.trim()}
          className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          送信
        </button>
      </form>
    </div>
  );
}
