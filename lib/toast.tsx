'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ApiError } from '@/lib/api';
import Toast, { type ToastKind } from '@/components/Toast';

export type { ToastKind };

function genericError(): string {
  return 'Что-то пошло не так';
}

/** Human-readable message for any thrown value (ApiError-aware). */
export function errMsg(e: unknown): string {
  if (e instanceof ApiError) return e.message || genericError();
  if (e instanceof Error) return e.message || genericError();
  if (typeof e === 'string' && e) return e;
  return genericError();
}

/** Errors linger; confirmations get out of the way faster. */
const DURATIONS: Record<ToastKind, number> = {
  ok: 4500,
  info: 5500,
  error: 8000,
};

const MAX_VISIBLE = 4;

interface ToastItem {
  id: number;
  msg: string;
  kind: ToastKind;
}

interface ToastContextValue {
  toast(msg: string, kind?: ToastKind): void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [items, setItems] = useState<ToastItem[]>([]);
  const idRef = useRef(1);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Each Toast owns its own timer (so hover can pause it); the provider only
  // caps how many are on screen at once.
  const toast = useCallback((msg: string, kind: ToastKind = 'ok') => {
    setItems((prev) => [...prev, { id: idRef.current++, msg, kind }].slice(-MAX_VISIBLE));
  }, []);

  const value = useMemo<ToastContextValue>(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {items.map((t) => (
          <Toast
            key={t.id}
            message={t.msg}
            kind={t.kind}
            duration={DURATIONS[t.kind]}
            onDismiss={() => dismiss(t.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
