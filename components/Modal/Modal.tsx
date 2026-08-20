'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useAnimatedPresence } from '@/lib/useAnimatedPresence';
import styles from './Modal.module.css';

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({
  open,
  onClose,
  title,
  size = 'default',
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  size?: 'default' | 'wide';
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  const showMounted = useAnimatedPresence(open, 180);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  // Move focus into the dialog once it's mounted (so both the panel exists
  // and its focusable descendants are in the DOM to query), and return it to
  // whatever triggered the dialog when it closes.
  useEffect(() => {
    if (!open || !showMounted) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel)?.focus();
    return () => {
      previousFocusRef.current?.focus?.();
    };
  }, [open, showMounted]);

  if (!mounted || !showMounted) return null;

  return createPortal(
    <div
      className={[styles.overlay, size === 'wide' ? styles.overlayWide : '', open ? '' : styles.overlayOut]
        .filter(Boolean)
        .join(' ')}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        className={[styles.panel, size === 'wide' ? styles.panelWide : '', open ? '' : styles.panelOut]
          .filter(Boolean)
          .join(' ')}
        role="dialog"
        aria-modal="true"
        aria-label={title || 'Диалог'}
        tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key !== 'Tab') return;
          const panel = panelRef.current;
          if (!panel) return;
          const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
          if (focusable.length === 0) return;
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }}
      >
        <span className={styles.topBar} aria-hidden="true" />
        <div className={styles.head}>
          {title ? <h3 className={styles.title}>{title}</h3> : <span />}
          <button type="button" className={styles.close} onClick={onClose} aria-label="Закрыть">
            <X size={18} />
          </button>
        </div>
        <div className={styles.body}>{children}</div>
      </div>
    </div>,
    document.body
  );
}

export default Modal;
