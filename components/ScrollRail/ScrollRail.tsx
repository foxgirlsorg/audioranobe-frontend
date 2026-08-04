'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import styles from './ScrollRail.module.css';

export function ScrollRail({
  children,
  step = 1,
  className = '',
}: {
  children: React.ReactNode;
  step?: number;
  className?: string;
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [hasOverflow, setHasOverflow] = useState(false);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(true);

  const measure = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setHasOverflow(max > 1);
    setAtStart(el.scrollLeft < 8);
    setAtEnd(el.scrollLeft >= max - 8);
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollLeft = 0;
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

  const scrollBy = (dir: -1 | 1) => {
    const el = trackRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>('[data-rail-card]');
    const stepDist = card ? (card.offsetWidth + 20) * step * dir : el.clientWidth * dir;
    el.scrollBy({ left: stepDist, behavior: 'smooth' });
  };

  const wrapCls = [
    styles.wrap,
    hasOverflow && !atStart ? styles.fadeStart : '',
    hasOverflow && !atEnd ? styles.fadeEnd : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={wrapCls}>
      <div className={styles.track} ref={trackRef}>
        {children}
      </div>
      {hasOverflow && !atStart ? (
        <button
          type="button"
          className={`${styles.btn} ${styles.btnLeft}`}
          onClick={() => scrollBy(-1)}
          aria-label="Прокрутить назад"
        >
          <ChevronLeft size={20} />
        </button>
      ) : null}
      {hasOverflow && !atEnd ? (
        <button
          type="button"
          className={`${styles.btn} ${styles.btnRight}`}
          onClick={() => scrollBy(1)}
          aria-label="Прокрутить вперёд"
        >
          <ChevronRight size={20} />
        </button>
      ) : null}
    </div>
  );
}

export default ScrollRail;
