'use client';

import { useEffect, useRef } from 'react';
import { RotateCcw } from 'lucide-react';
import Spinner from '@/components/Spinner/Spinner';
import styles from './InfiniteScroll.module.css';

/**
 * The foot of an infinite list: a sentinel that asks for the next page when it
 * scrolls into view, and a retry button when that request failed.
 */
export default function InfiniteScroll({
  hasMore,
  loading,
  error,
  onLoad,
  total,
  shown,
}: {
  hasMore: boolean;
  loading: boolean;
  error: string;
  onLoad: () => void;
  total?: number;
  shown?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const cb = useRef(onLoad);
  cb.current = onLoad;

  useEffect(() => {
    const el = ref.current;
    if (!el || !hasMore || loading || error) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) cb.current();
      },
      { rootMargin: '400px 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loading, error]);

  if (!hasMore && !loading && !error) {
    return total !== undefined && shown !== undefined && total > 0 ? (
      <p className={styles.done}>{`Показано ${shown} из ${total}`}</p>
    ) : null;
  }

  return (
    <div ref={ref} className={styles.foot}>
      {error ? (
        <>
          <p className={styles.error}>{error}</p>
          <button type="button" className="btn" onClick={onLoad}>
            <RotateCcw size={14} />
            Попробовать ещё раз
          </button>
        </>
      ) : (
        <Spinner size={22} />
      )}
    </div>
  );
}
