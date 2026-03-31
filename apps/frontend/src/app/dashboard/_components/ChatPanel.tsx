'use client';

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from 'react';
import {
  createChatSession,
  getChatMessages,
  sendChatMessage,
} from '../../../lib/api/chat';
import { ChatMessageItem, ChatSession } from '../../../types/chat';

type ChatState =
  | { status: 'no-session' }
  | { status: 'loading-session' }
  | { status: 'ready'; session: ChatSession; messages: ChatMessageItem[] }
  | { status: 'sending'; session: ChatSession; messages: ChatMessageItem[] }
  | { status: 'error'; message: string };

interface ChatPanelProps {
  backendToken: string;
}

export function ChatPanel({ backendToken }: ChatPanelProps) {
  const [state, setState] = useState<ChatState>({ status: 'no-session' });
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  // メッセージが増えたら最下部へスクロール
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state]);

  const startSession = async () => {
    setState({ status: 'loading-session' });
    try {
      const session = await createChatSession(backendToken);
      const messages = await getChatMessages(session.id, backendToken);
      setState({ status: 'ready', session, messages });
    } catch {
      setState({ status: 'error', message: 'セッションの作成に失敗しました' });
    }
  };

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
      const response = await sendChatMessage(
        current.session.id,
        trimmed,
        backendToken,
      );
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
    } catch (error) {
      setState({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'メッセージの送信に失敗しました',
      });
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as FormEvent);
    }
  };

  const isDisabled = state.status === 'sending' || state.status === 'loading-session';
  const messages =
    state.status === 'ready' || state.status === 'sending'
      ? state.messages
      : [];

  return (
    <div className="mt-6 rounded-2xl bg-white shadow-sm dark:bg-zinc-900">
      <div className="border-b border-zinc-200 px-8 py-4 dark:border-zinc-800">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          支出アシスタント
        </h2>
      </div>

      {state.status === 'no-session' && (
        <div className="flex flex-col items-center gap-4 px-8 py-12 text-center">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            支出についての質問にお答えします
          </p>
          <button
            onClick={startSession}
            className="rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            チャットを開始
          </button>
        </div>
      )}

      {state.status === 'loading-session' && (
        <div className="flex items-center justify-center px-8 py-12">
          <p className="text-sm text-zinc-400 dark:text-zinc-500">準備中...</p>
        </div>
      )}

      {state.status === 'error' && (
        <div className="px-8 py-6">
          <p className="text-sm text-red-600 dark:text-red-400">{state.message}</p>
          <button
            onClick={() => setState({ status: 'no-session' })}
            className="mt-3 text-sm text-zinc-500 underline hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            やり直す
          </button>
        </div>
      )}

      {(state.status === 'ready' || state.status === 'sending') && (
        <>
          <div className="h-80 overflow-y-auto px-8 py-4">
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
            className="flex items-end gap-3 border-t border-zinc-200 px-6 py-4 dark:border-zinc-800"
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
        </>
      )}
    </div>
  );
}
