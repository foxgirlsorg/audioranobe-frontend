'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { errMsg } from '@/lib/toast';
import { formatCount } from '@/lib/format';
import type { NarratorStats, StatsDay } from '@/lib/types';
import Spinner from '@/components/Spinner/Spinner';
import {
  Kpi,
  ListeningCharts,
  ListsAndRatings,
  MiniCharts,
  RangeSwitch,
  fmtHours,
  listTotal,
  statsStyles as styles,
  sumSeries,
} from '@/components/StatsBlocks/StatsBlocks';

const MINI: { key: keyof StatsDay; label: string }[] = [
  { key: 'subscribers', label: 'Новые подписчики' },
  { key: 'views', label: 'Новые посетители' },
  { key: 'library_adds', label: 'Добавления в списки' },
  { key: 'favorites', label: 'В избранное' },
  { key: 'ratings', label: 'Оценки' },
  { key: 'comments', label: 'Комментарии' },
];

/** Private narrator stats for the narrator edit page's «Статистика» tab. */
export default function NarratorStatsView({ narratorId }: { narratorId: number }) {
  const [stats, setStats] = useState<NarratorStats | null>(null);
  const [days, setDays] = useState(30);
  const [error, setError] = useState('');

  useEffect(() => {
    setError('');
    api<NarratorStats>(`/panel/narrators/${narratorId}/stats`, { params: { days } })
      .then(setStats)
      .catch((e) => setError(errMsg(e)));
  }, [narratorId, days]);

  if (error) return <p className={styles.empty}>{error}</p>;

  const t = stats?.totals;
  const series = stats?.series ?? [];
  const titles = [...(stats?.titles ?? [])].sort((a, b) => b.listeners - a.listeners || b.listens - a.listens);

  return (
    <div className={styles.page}>
      <RangeSwitch days={days} onChange={setDays} />

      {!stats || !t ? (
        <Spinner />
      ) : (
        <>
          <section className={styles.kpis}>
            <Kpi
              value={formatCount(stats.subscribers_count)}
              label={'Подписчики'}
              hint={`+${formatCount(sumSeries(series, 'subscribers'))} за период`}
            />
            <Kpi value={formatCount(t.listeners)} label={'Слушатели'} />
            <Kpi value={fmtHours(t.listen_seconds)} label={'Время прослушивания'} hint={`${fmtHours(sumSeries(series, 'listen_seconds'))} за период`} />
            <Kpi value={formatCount(t.listens)} label={'Прослушивания глав'} />
            <Kpi value={formatCount(t.views)} label={'Просмотры'} hint={`+${formatCount(sumSeries(series, 'views'))} новых за период`} />
            <Kpi value={formatCount(t.favorites)} label={'В избранном'} hint={`+${formatCount(sumSeries(series, 'favorites'))} за период`} />
            <Kpi
              value={t.avg_rating != null ? t.avg_rating.toFixed(1) : '—'}
              label={'Средняя оценка'}
              hint={`${formatCount(t.ratings)} оценок`}
            />
            <Kpi value={formatCount(listTotal(t.lists))} label={'В списках'} hint={`+${formatCount(sumSeries(series, 'library_adds'))} за период`} />
          </section>

          <ListeningCharts series={series} />
          <MiniCharts series={series} items={MINI} />
          <ListsAndRatings lists={t.lists} distribution={t.rating_distribution} avg={t.avg_rating} />

          <section className={`glass-panel ${styles.panel}`}>
            <h2 className={styles.panelTitle}>
              {'По тайтлам'}
              <span className={styles.panelValue}>{formatCount(titles.length)}</span>
            </h2>
            {titles.length === 0 ? (
              <p className={styles.empty}>{'Тайтлов пока нет.'}</p>
            ) : (
              <div className={styles.tableScroll}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>{'Тайтл'}</th>
                      <th className={styles.num}>{'Слушатели'}</th>
                      <th className={styles.num}>{'Прослушивания'}</th>
                      <th className={styles.num}>{'Просмотры'}</th>
                      <th className={styles.num}>{'В списках'}</th>
                      <th className={styles.num}>{'Избранное'}</th>
                      <th className={styles.num}>{'Оценка'}</th>
                      <th className={styles.num}>{'Комментарии'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {titles.map((x) => (
                      <tr key={x.id}>
                        <td>
                          <Link href={`/title/${x.slug}/edit?tab=stats`} className={styles.rowLink}>
                            {x.name}
                          </Link>
                        </td>
                        <td className={styles.num}>{formatCount(x.listeners)}</td>
                        <td className={styles.num}>{formatCount(x.listens)}</td>
                        <td className={styles.num}>{formatCount(x.views_count)}</td>
                        <td className={styles.num}>{formatCount(listTotal(x.lists))}</td>
                        <td className={styles.num}>{formatCount(x.favorites_count)}</td>
                        <td className={styles.num}>
                          {x.avg_rating != null ? `${x.avg_rating.toFixed(1)}★ · ${formatCount(x.rating_count)}` : '—'}
                        </td>
                        <td className={styles.num}>{formatCount(x.comments_count)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
