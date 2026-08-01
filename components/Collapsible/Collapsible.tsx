'use client';

import React, { useEffect, useRef, useState } from 'react';
import styles from './Collapsible.module.css';

export default function Collapsible({
  children,
  maxHeight = 260,
  moreLabel = 'Читать полностью',
  lessLabel = 'Свернуть',
}: {
  children: React.ReactNode;
  maxHeight?: number;
  moreLabel?: string;
  lessLabel?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [clipped, setClipped] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setClipped(el.scrollHeight > maxHeight + 8);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    for (const child of Array.from(el.children)) ro.observe(child);
    return () => ro.disconnect();
  }, [maxHeight, children]);

  const collapsed = clipped && !open;

  return (
    <div className={styles.wrap}>
      <div
        ref={ref}
        className={collapsed ? `${styles.body} ${styles.clipped}` : styles.body}
        style={collapsed ? { maxHeight } : undefined}
      >
        {children}
      </div>
      {clipped ? (
        <button
          type="button"
          className={styles.toggle}
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
        >
          {open ? lessLabel : moreLabel}
        </button>
      ) : null}
    </div>
  );
}
