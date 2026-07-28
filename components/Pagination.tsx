'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import styles from './Pagination.module.css';

function pageList(cur: number, max: number): (number | '…')[] {
  const wanted = new Set<number>([1, 2, max - 1, max, cur - 1, cur, cur + 1]);
  const arr = [...wanted].filter((n) => n >= 1 && n <= max).sort((a, b) => a - b);
  const out: (number | '…')[] = [];
  let prev = 0;
  for (const n of arr) {
    if (prev && n - prev > 1) out.push('…');
    out.push(n);
    prev = n;
  }
  return out;
}

export function Pagination({
  page,
  total,
  perPage,
  onPage,
}: {
  page: number;
  total: number;
  perPage: number;
  onPage: (p: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / Math.max(1, perPage)));
  if (pages <= 1) return null;
  const cur = Math.min(Math.max(1, page), pages);

  return (
    <nav className={styles.nav} aria-label="Навигация по страницам">
      <button
        type="button"
        className={styles.arrow}
        disabled={cur <= 1}
        onClick={() => onPage(cur - 1)}
        aria-label="Предыдущая страница"
      >
        <ChevronLeft size={16} />
      </button>
      {pageList(cur, pages).map((p, i) =>
        p === '…' ? (
          <span key={`gap-${i}`} className={styles.gap}>
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            className={p === cur ? `${styles.page} ${styles.active}` : styles.page}
            aria-current={p === cur ? 'page' : undefined}
            onClick={() => onPage(p)}
          >
            {p}
          </button>
        )
      )}
      <button
        type="button"
        className={styles.arrow}
        disabled={cur >= pages}
        onClick={() => onPage(cur + 1)}
        aria-label="Следующая страница"
      >
        <ChevronRight size={16} />
      </button>
    </nav>
  );
}

export default Pagination;
