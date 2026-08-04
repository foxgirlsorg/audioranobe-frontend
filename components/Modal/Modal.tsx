'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import styles from './Modal.module.css';

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

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className={`${styles.overlay}${size === 'wide' ? ` ${styles.overlayWide}` : ''}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`${styles.panel}${size === 'wide' ? ` ${styles.panelWide}` : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title || 'Диалог'}
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
