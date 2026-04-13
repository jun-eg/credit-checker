'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

export type AppMode =
  | { type: 'personal' }
  | { type: 'room'; room: { id: string; name: string } };

const COOKIE_NAME = 'app-mode';
const COOKIE_PATH = '/';

function encodeMode(mode: AppMode): string {
  if (mode.type === 'personal') return 'personal';
  return `room:${mode.room.id}:${encodeURIComponent(mode.room.name)}`;
}

function decodeMode(value: string): AppMode | null {
  if (value === 'personal') return { type: 'personal' };
  if (value.startsWith('room:')) {
    const [, id, encodedName] = value.split(':');
    if (!id || !encodedName) return null;
    return { type: 'room', room: { id, name: decodeURIComponent(encodedName) } };
  }
  return null;
}

function readModeCookie(): AppMode | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${COOKIE_NAME}=`));
  if (!match) return null;
  return decodeMode(match.split('=').slice(1).join('='));
}

function writeModeCookie(mode: AppMode): void {
  document.cookie = `${COOKIE_NAME}=${encodeMode(mode)}; path=${COOKIE_PATH}; SameSite=Lax`;
}

function deleteModeCookie(): void {
  document.cookie = `${COOKIE_NAME}=; path=${COOKIE_PATH}; max-age=0`;
}

interface ModeContextValue {
  mode: AppMode | null;
  setMode: (mode: AppMode) => void;
  clearMode: () => void;
}

const ModeContext = createContext<ModeContextValue | null>(null);

export function ModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<AppMode | null>(() => readModeCookie());

  const setMode = useCallback((newMode: AppMode) => {
    writeModeCookie(newMode);
    setModeState(newMode);
  }, []);

  const clearMode = useCallback(() => {
    deleteModeCookie();
    setModeState(null);
  }, []);

  return (
    <ModeContext.Provider value={{ mode, setMode, clearMode }}>
      {children}
    </ModeContext.Provider>
  );
}

export function useMode(): ModeContextValue {
  const ctx = useContext(ModeContext);
  if (!ctx) throw new Error('useMode must be used within ModeProvider');
  return ctx;
}
