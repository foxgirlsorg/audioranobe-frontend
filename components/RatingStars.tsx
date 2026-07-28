'use client';

import { useState } from 'react';
import { Star } from 'lucide-react';
import styles from './RatingStars.module.css';

export function RatingStars({
  value,
  count,
  my,
  onRate,
}: {
  value: number | null;
  count: number;
  my: number | null;
  onRate?: (v: number | null) => void;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const interactive = typeof onRate === 'function';

  // What the stars visualize: hover preview > my rating > average.
  const display = hover ?? my ?? (value != null ? Number(value) : 0);

  function click(i: number) {
    if (!onRate) return;
    onRate(i === my ? null : i);
  }

  return (
    <div className={styles.wrap}>
      <div
        className={interactive ? `${styles.stars} ${styles.interactive}` : styles.stars}
        onMouseLeave={() => setHover(null)}
        role={interactive ? 'radiogroup' : 'img'}
        aria-label={
          value != null
            ? `Оценка ${Number(value).toFixed(1)} из 10`
            : 'Оценок пока нет'
        }
      >
        {Array.from({ length: 10 }, (_, idx) => {
          const i = idx + 1;
          const frac = Math.min(1, Math.max(0, display - idx));
          return (
            <button
              key={i}
              type="button"
              className={styles.star}
              disabled={!interactive}
              tabIndex={interactive ? 0 : -1}
              onMouseEnter={interactive ? () => setHover(i) : undefined}
              onFocus={interactive ? () => setHover(i) : undefined}
              onBlur={interactive ? () => setHover(null) : undefined}
              onClick={() => click(i)}
              aria-label={
                i === my
                  ? `Убрать вашу оценку ${i}`
                  : `Оценить на ${i} из 10`
              }
              title={
                interactive
                  ? i === my
                    ? 'Нажмите, чтобы убрать оценку'
                    : `Оценить на ${i}`
                  : undefined
              }
            >
              <Star size={18} className={styles.base} />
              <span
                className={hover != null ? `${styles.fill} ${styles.preview}` : styles.fill}
                style={{ width: `${frac * 100}%` }}
                aria-hidden="true"
              >
                <Star size={18} className={styles.filled} />
              </span>
            </button>
          );
        })}
      </div>
      <div className={styles.text}>
        {value != null ? (
          <>
            <span className={styles.avg}>{Number(value).toFixed(1)}</span>
            <span className={styles.dot}>·</span>
            {`Оценок: ${count}`}
          </>
        ) : (
          'Оценок пока нет'
        )}
        {my != null ? <span className={styles.mine}>· {`ваша: ${my}`}</span> : null}
      </div>
    </div>
  );
}

export default RatingStars;
