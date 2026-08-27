'use client';

import React, { forwardRef, useEffect, useRef, useState } from 'react';
import type { Recap } from '@/lib/types';
import styles from './RecapMonthlyCard.module.css';

function ruPlural(n: number, forms: [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms[1];
  return forms[2];
}

/** Single shareable monthly recap card (dark + coral + foxgirl theme). */
const RecapMonthlyCard = forwardRef<HTMLDivElement, { recap: Recap }>(({ recap }, ref) => {
  const hours = Math.floor(recap.total_seconds / 3600);
  const mins = Math.floor((recap.total_seconds % 3600) / 60);
  const big = hours > 0 ? hours : mins;
  const unit = hours > 0 ? ruPlural(hours, ['час', 'часа', 'часов']) : ruPlural(mins, ['минута', 'минуты', 'минут']);
  const topTitles = recap.top_titles.slice(0, 3);
  const topNarrator = recap.top_narrators[0];
  const mLabel = (sec: number) => `${Math.max(1, Math.round(sec / 60))} ${ruPlural(Math.round(sec / 60), ['минута', 'минуты', 'минут'])}`;

  const innerRef = useRef<HTMLDivElement | null>(null);
  const bigNumRef = useRef<HTMLSpanElement | null>(null);
  const unitRef = useRef<HTMLSpanElement | null>(null);
  const [stacked, setStacked] = useState(false);
  const [bigFontSize, setBigFontSize] = useState(96);

  const MAX_FONT = 96;
  const MIN_FONT = 22;

  useEffect(() => {
    const container = innerRef.current;
    const numEl = bigNumRef.current;
    if (!container || !numEl) return;

    const fit = () => {
      const budget = container.clientWidth;
      let size = MAX_FONT;
      numEl.style.fontSize = `${size}px`;
      while (size > MIN_FONT && numEl.scrollWidth > budget) {
        size -= 4;
        numEl.style.fontSize = `${size}px`;
      }
      setBigFontSize(size);
    };

    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(container);
    return () => ro.disconnect();
  }, [big]);

  useEffect(() => {
    const bigEl = bigNumRef.current;
    const unitEl = unitRef.current;
    if (!bigEl || !unitEl) return;
    // The unit only reads as one line once it's actually wrapped onto its own
    // row below the number — detected from real layout, not a digit-count guess.
    // (offsetTop alone doesn't work: align-items:flex-end already puts a
    // shorter same-row item lower than the tall number, without any wrap.)
    const check = () => setStacked(unitEl.getBoundingClientRect().left < bigEl.getBoundingClientRect().right);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(bigEl);
    ro.observe(unitEl);
    return () => ro.disconnect();
  }, [big, bigFontSize]);

  return (
    <div className={styles.card} ref={ref}>
      <div className={styles.glow} aria-hidden="true" />
      <div className={styles.glow2} aria-hidden="true" />
      <div className={styles.foxgirl} aria-hidden="true" />
      <div className={styles.shade} aria-hidden="true" />

      <div className={styles.inner} ref={innerRef}>
        <header className={styles.head}>
          <div className={styles.who}>
            <span className={styles.name}>{recap.display_name || recap.username}</span>
            {recap.username ? <span className={styles.handle}>@{recap.username}</span> : null}
          </div>
          <div className={styles.period}>{recap.period_label}</div>
        </header>

        <div className={styles.big} data-stacked={stacked || undefined}>
          <span className={styles.bigNum} ref={bigNumRef} style={{ fontSize: `${bigFontSize}px` }}>{big}</span>
          <span className={styles.unit} ref={unitRef}>
            {unit}
            <br className={styles.unitBreak} />
            {' '}
            прослушано
          </span>
        </div>

        <div className={styles.foot}>
          <div className={styles.stats}>
            <span className={styles.stat}><b>{recap.files_count}</b> {ruPlural(recap.files_count, ['глава', 'главы', 'глав'])}</span>
            <span className={styles.stat}><b>{recap.titles_count}</b> {ruPlural(recap.titles_count, ['тайтл', 'тайтла', 'тайтлов'])}</span>
            {recap.books_finished > 0 ? (
              <span className={styles.stat}><b>{recap.books_finished}</b> целиком</span>
            ) : null}
          </div>

          {topTitles.length > 0 ? (
            <div className={styles.fav}>
              <span className={styles.favLabel}>{topTitles.length > 1 ? 'Любимые тайтлы' : 'Любимый тайтл'}</span>
              <ol className={styles.favList}>
                {topTitles.map((t) => (
                  <li key={t.slug} className={styles.favRow}>
                    <span className={styles.favValue}>{t.name}</span>
                    <span className={styles.favTime}>{mLabel(t.seconds)}</span>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
          {topNarrator ? (
            <div className={styles.fav}>
              <span className={styles.favLabel}>Любимый чтец</span>
              <div className={styles.favRow}>
                <span className={styles.favValue}>{topNarrator.name}</span>
                <span className={styles.favTime}>{mLabel(topNarrator.seconds)}</span>
              </div>
            </div>
          ) : null}

          <div className={styles.brand}>AudioRanobe</div>
        </div>
      </div>
    </div>
  );
});

RecapMonthlyCard.displayName = 'RecapMonthlyCard';
export default RecapMonthlyCard;
