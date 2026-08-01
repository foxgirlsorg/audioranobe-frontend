'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import styles from './TabScroller.module.css';

export default function TabScroller({
  children,
  ariaLabel,
  as: Tag = 'div',
  className = '',
  stripClassName = '',
}: {
  children: React.ReactNode;
  ariaLabel?: string;
  as?: 'nav' | 'div';
  className?: string;
  stripClassName?: string;
}) {
  const stripRef = useRef<HTMLDivElement | null>(null);
  const [edges, setEdges] = useState({ start: false, end: false });

  const measure = useCallback(() => {
    const el = stripRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setEdges({ start: el.scrollLeft > 1, end: el.scrollLeft < max - 1 });
  }, []);

  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;

    measure();
    el.addEventListener('scroll', measure, { passive: true });

    const ro = new ResizeObserver(measure);
    ro.observe(el);
    for (const child of Array.from(el.children)) ro.observe(child);

    return () => {
      el.removeEventListener('scroll', measure);
      ro.disconnect();
    };
  }, [measure, children]);

  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth) return;
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    const active = el.querySelector<HTMLElement>('[aria-current="page"], [aria-selected="true"]');
    if (!active) return;
    const left = active.offsetLeft;
    const right = left + active.offsetWidth;
    const pad = 24;
    if (left < el.scrollLeft + pad) {
      el.scrollLeft = Math.max(0, left - pad);
    } else if (right > el.scrollLeft + el.clientWidth - pad) {
      el.scrollLeft = right - el.clientWidth + pad;
    }
  }, [children]);

  const cls = [
    styles.viewport,
    edges.start ? styles.fadeStart : '',
    edges.end ? styles.fadeEnd : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={cls}>
      <Tag
        className={stripClassName ? `${styles.strip} ${stripClassName}` : styles.strip}
        ref={stripRef as React.Ref<HTMLDivElement & HTMLElement>}
        aria-label={ariaLabel}
      >
        {children}
      </Tag>
    </div>
  );
}
