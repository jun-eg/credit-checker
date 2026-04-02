'use client';

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from 'react';
import { getChatMessages, sendChatMessage } from '../../../lib/api/chat';
import { ChatMessageItem, ChatSession } from '../../../types/chat';

type ThreadState =
  | { status: 'empty' }
  | { status: 'loading' }
  | { status: 'ready'; session: ChatSession; messages: ChatMessageItem[] }
  | { status: 'sending'; session: ChatSession; messages: ChatMessageItem[] }
  | { status: 'error'; message: string };

interface MessageThreadProps {
  backendToken: string;
  sessionId: string | null;
  onMessageSent?: () => void;
}

export function MessageThread({
  backendToken,
  sessionId,
  onMessageSent,
}: MessageThreadProps) {
  const [state, setState] = useState<ThreadState>({ status: 'empty' });
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state]);

  useEffect(() => {
    if (!sessionId) {
      setState({ status: 'empty' });
      return;
    }

    setState({ status: 'loading' });
    getChatMessages(sessionId, backendToken)
      .then((messages) => {
        setState({
          status: 'ready',
          session: { id: sessionId, title: null, createdAt: new Date().toISOString() },
          messages,
        });
      })
      .catch(() => {
        setState({ status: 'error', message: 'メッセージの取得に失敗しました' });
      });
  }, [sessionId, backendToken]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;

    const current = state;
    if (current.status !== 'ready') return;

    const optimisticMessage: ChatMessageItem = {
      id: `optimistic-${Date.now()}`,
      role: 'user',
      content: trimmed,
      createdAt: new Date().toISOString(),
    };

    setState({
      status: 'sending',
      session: current.session,
      messages: [...current.messages, optimisticMessage],
    });
    setInput('');

    try {
      const response = await sendChatMessage(current.session.id, trimmed, backendToken);
      const assistantMessage: ChatMessageItem = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.reply,
        createdAt: new Date().toISOString(),
      };
      setState({
        status: 'ready',
        session: current.session,
        messages: [...current.messages, optimisticMessage, assistantMessage],
      });
      // タイトルが更新されるのでサイドバーを再取得する
      onMessageSent?.();
    } catch (error) {
      setState({
        status: 'error',
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

  const isDisabled = state.status === 'sending' || state.status === 'loading';
  const messages =
    state.status === 'ready' || state.status === 'sending' ? state.messages : [];

  if (state.status === 'empty') {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-zinc-400 dark:text-zinc-500">
          左のサイドバーからチャットを選択するか、新規チャットを開始してください
        </p>
      </div>
    );
  }

  if (state.status === 'loading') {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-zinc-400 dark:text-zinc-500">読み込み中...</p>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3">
        <p className="text-sm text-red-600 dark:text-red-400">{state.message}</p>
        <button
          onClick={() => setState({ status: 'empty' })}
          className="text-sm text-zinc-500 underline hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          やり直す
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-8">
        {messages.length === 0 && (
          <p className="text-center text-sm text-zinc-400 dark:text-zinc-500">
            質問を入力してください（例:「今月の食費を教えて」）
          </p>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`mb-4 flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900'
                  : 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {state.status === 'sending' && (
          <div className="mb-4 flex justify-start">
            <div className="rounded-2xl bg-zinc-100 px-4 py-2 text-sm text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500">
              回答を生成中...
            </div>
          </div>
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
          disabled={isDisabled}
          placeholder="メッセージを入力（Enter で送信、Shift+Enter で改行）"
          rows={1}
          className="flex-1 resize-none rounded-xl border border-zinc-300 bg-transparent px-4 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-50 dark:placeholder-zinc-600 dark:focus:border-zinc-500"
        />
        <button
          type="submit"
          disabled={isDisabled || !input.trim()}
          className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          送信
        </button>
      </form>
    </div>
  );
}
