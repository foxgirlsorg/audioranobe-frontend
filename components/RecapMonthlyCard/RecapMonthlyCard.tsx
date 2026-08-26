'use client';

import React, { forwardRef } from 'react';
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
  const topTitle = recap.top_titles[0];
  const topNarrator = recap.top_narrators[0];
  const mLabel = (sec: number) => `${Math.max(1, Math.round(sec / 60))} ${ruPlural(Math.round(sec / 60), ['минута', 'минуты', 'минут'])}`;

  return (
    <div className={styles.card} ref={ref}>
      <div className={styles.glow} aria-hidden="true" />
      <div className={styles.glow2} aria-hidden="true" />
      <div className={styles.foxgirl} aria-hidden="true" />
      <div className={styles.shade} aria-hidden="true" />

      <div className={styles.inner}>
        <header className={styles.head}>
          <div className={styles.who}>
            <span className={styles.name}>{recap.display_name || recap.username}</span>
            {recap.username ? <span className={styles.handle}>@{recap.username}</span> : null}
          </div>
          <div className={styles.period}>{recap.period_label}</div>
        </header>

        <div className={styles.big}>
          <span className={styles.bigNum}>{big}</span>
          <span className={styles.unit}>{unit}<br />прослушано</span>
        </div>

        <div className={styles.foot}>
          <div className={styles.stats}>
            <span className={styles.stat}><b>{recap.files_count}</b> {ruPlural(recap.files_count, ['глава', 'главы', 'глав'])}</span>
            <span className={styles.stat}><b>{recap.titles_count}</b> {ruPlural(recap.titles_count, ['тайтл', 'тайтла', 'тайтлов'])}</span>
            {recap.books_finished > 0 ? (
              <span className={styles.stat}><b>{recap.books_finished}</b> целиком</span>
            ) : null}
          </div>

          {topTitle ? (
            <div className={styles.fav}>
              <span className={styles.favLabel}>Любимый тайтл</span>
              <span className={styles.favRow}>
                <span className={styles.favValue}>{topTitle.name}</span>
                <span className={styles.favTime}>{mLabel(topTitle.seconds)}</span>
              </span>
            </div>
          ) : null}
          {topNarrator ? (
            <div className={styles.fav}>
              <span className={styles.favLabel}>Любимый чтец</span>
              <span className={styles.favRow}>
                <span className={styles.favValue}>{topNarrator.name}</span>
                <span className={styles.favTime}>{mLabel(topNarrator.seconds)}</span>
              </span>
            </div>
          ) : null}

          <div className={styles.brand}>AudioRanobe · Итоги</div>
        </div>
      </div>
    </div>
  );
});

RecapMonthlyCard.displayName = 'RecapMonthlyCard';
export default RecapMonthlyCard;
