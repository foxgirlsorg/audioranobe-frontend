'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, type LucideIcon } from 'lucide-react';
import styles from './Toast.module.css';

export type ToastKind = 'ok' | 'error' | 'info';

const ICONS: Record<ToastKind, LucideIcon> = {
  ok: CheckCircle2,
  error: AlertTriangle,
  info: Info,
};

export default function Toast({
  message,
  kind,
  duration,
  onDismiss,
}: {
  message: string;
  kind: ToastKind;
  duration: number;
  onDismiss: () => void;
}) {
  const [paused, setPaused] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const remainingRef = useRef(duration);
  const startedRef = useRef(0);
  const timerRef = useRef<number | undefined>(undefined);

  const Icon = ICONS[kind];

  const close = () => {
    if (leaving) return;
    setLeaving(true);
    window.setTimeout(onDismiss, 180);
  };

  useEffect(() => {
    if (paused || leaving) {
      if (timerRef.current !== undefined) {
        window.clearTimeout(timerRef.current);
        timerRef.current = undefined;
        remainingRef.current -= Date.now() - startedRef.current;
      }
      return;
    }
    startedRef.current = Date.now();
    timerRef.current = window.setTimeout(close, Math.max(0, remainingRef.current));
    return () => {
      if (timerRef.current !== undefined) window.clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, leaving]);

  return (
    <div
      className={`${styles.toast} ${styles[kind]} ${leaving ? styles.leaving : ''}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      role={kind === 'error' ? 'alert' : 'status'}
    >
      <span className={styles.icon} aria-hidden="true">
        <Icon size={17} />
      </span>
      <span className={styles.message}>{message}</span>
      <button type="button" className={styles.close} onClick={close} aria-label="Закрыть">
        <X size={14} />
      </button>
      <span
        className={styles.progress}
        style={{
          animationDuration: `${duration}ms`,
          animationPlayState: paused ? 'paused' : 'running',
        }}
        aria-hidden="true"
      />
    </div>
  );
}
