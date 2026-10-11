'use client';

import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '@/lib/api';
import { errMsg } from '@/lib/toast';
import { formatCount } from '@/lib/format';
import type { StatsDay, TitleStatsChapter, TitleStatsFull } from '@/lib/types';
import Spinner from '@/components/Spinner/Spinner';
import {
  AXIS_TICK,
  CURSOR,
  GRID,
  Kpi,
  ListeningCharts,
  ListsAndRatings,
  MiniCharts,
  RangeSwitch,
  Tip,
  fmtHours,
  listTotal,
  splitSeries,
  statsStyles as styles,
  sumSeries,
  trend,
} from '@/components/StatsBlocks/StatsBlocks';

const MINI: { key: keyof StatsDay; label: string }[] = [
  { key: 'views', label: 'Новые посетители' },
  { key: 'library_adds', label: 'Добавления в списки' },
  { key: 'favorites', label: 'В избранное' },
  { key: 'ratings', label: 'Оценки' },
  { key: 'comments', label: 'Комментарии' },
  { key: 'embed_plays', label: 'Прослушивания из виджета' },
];

const chapterLabel = (c: TitleStatsChapter) =>
  `${c.volume_number}·${c.number_end ? `${c.number}–${c.number_end}` : c.number}`;

/** Private title stats for the edit page's «Статистика» tab (narrators and mods). */
export default function TitleStatsDashboard({ titleId }: { titleId: number }) {
  const [stats, setStats] = useState<TitleStatsFull | null>(null);
  const [days, setDays] = useState(30);
  const [error, setError] = useState('');

  useEffect(() => {
    setError('');
    api<TitleStatsFull>(`/panel/titles/${titleId}/stats`, { params: { days: days * 2 } })
      .then(setStats)
      .catch((e) => setError(errMsg(e)));
  }, [titleId, days]);

  if (error) return <p className={styles.empty}>{error}</p>;

  const [series, prev] = splitSeries(stats?.series ?? [], days);
  const chapters = stats?.chapters ?? [];
  const firstListeners = chapters.find((c) => c.listeners > 0)?.listeners ?? 0;

  return (
    <div className={styles.page}>
      <RangeSwitch days={days} onChange={setDays} />

      {!stats ? (
        <Spinner />
      ) : (
        <>
          <section className={styles.kpis}>
            <Kpi value={formatCount(stats.listeners)} label={'Слушатели'} />
            <Kpi
              value={fmtHours(stats.listen_seconds)}
              label={'Время прослушивания'}
              hint={`${fmtHours(sumSeries(series, 'listen_seconds'))} за период`}
              change={trend(series, prev, 'listen_seconds')}
            />
            <Kpi value={formatCount(stats.listens)} label={'Прослушивания глав'} />
            <Kpi
              value={formatCount(stats.views_count)}
              label={'Просмотры'}
              hint={`+${formatCount(sumSeries(series, 'views'))} новых за период`}
              change={trend(series, prev, 'views')}
            />
            <Kpi
              value={formatCount(stats.favorites_count)}
              label={'В избранном'}
              hint={`+${formatCount(sumSeries(series, 'favorites'))} за период`}
              change={trend(series, prev, 'favorites')}
            />
            <Kpi
              value={stats.avg_rating != null ? stats.avg_rating.toFixed(1) : '—'}
              label={'Средняя оценка'}
              hint={`${formatCount(stats.rating_count)} оценок`}
            />
            <Kpi
              value={formatCount(listTotal(stats.lists))}
              label={'В списках'}
              hint={`+${formatCount(sumSeries(series, 'library_adds'))} за период`}
              change={trend(series, prev, 'library_adds')}
            />
            <Kpi value={formatCount(stats.comments_count)} label={'Комментарии'} change={trend(series, prev, 'comments')} />
            <Kpi
              value={formatCount(stats.embed_plays)}
              label={'Из виджета'}
              hint={`+${formatCount(sumSeries(series, 'embed_plays'))} за период · сайтов: ${stats.embed_sites.length}`}
              change={trend(series, prev, 'embed_plays')}
            />
          </section>

          <ListeningCharts series={series} />
          <MiniCharts series={series} items={MINI} />
          <ListsAndRatings lists={stats.lists} distribution={stats.rating_distribution} avg={stats.avg_rating} />

          <section className={`glass-panel ${styles.panel}`}>
            <h2 className={styles.panelTitle}>
              {'Сайты с виджетом'}
              <span className={styles.panelValue}>{formatCount(stats.embed_sites.length)}</span>
            </h2>
            {stats.embed_sites.length === 0 ? (
              <p className={styles.empty}>{'Виджет тайтла пока не слушали на других сайтах.'}</p>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>{'Сайт'}</th>
                    <th className={styles.num}>{'Прослушивания'}</th>
                    <th className={styles.num}>{'Последнее'}</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.embed_sites.map((site) => (
                    <tr key={site.host}>
                      <td>{site.host}</td>
                      <td className={styles.num}>{formatCount(site.plays)}</td>
                      <td className={styles.num}>{new Date(site.last_seen * 1000).toLocaleDateString('ru-RU')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className={`glass-panel ${styles.panel}`}>
            <h2 className={styles.panelTitle}>
              {'Слушатели по главам'}
              <span className={styles.legendInline}>
                <span className={styles.swatch} style={{ background: 'rgba(222, 97, 97, 0.35)' }} />
                {'начали'}
                <span className={styles.swatch} style={{ background: 'var(--accent)' }} />
                {'дослушали'}
              </span>
            </h2>
            {chapters.length === 0 ? (
              <p className={styles.empty}>{'Глав пока нет.'}</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart
                    data={chapters.map((c) => ({ ...c, label: chapterLabel(c) }))}
                    margin={{ top: 8, right: 4, bottom: 0, left: 0 }}
                    barGap={-1000}
                    barCategoryGap={chapters.length > 80 ? 0 : '15%'}
                  >
                    <CartesianGrid vertical={false} stroke={GRID} />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={AXIS_TICK} minTickGap={16} />
                    <YAxis axisLine={false} tickLine={false} tick={AXIS_TICK} width={44} allowDecimals={false} />
                    <Tooltip
                      cursor={CURSOR}
                      content={
                        <Tip
                          render={(c: TitleStatsChapter & { label: string }) => (
                            <>
                              <span className={styles.tipHead}>{`${c.label}${c.name ? ` · ${c.name}` : ''}`}</span>
                              {`начали ${formatCount(c.listeners)} · дослушали ${formatCount(c.finished)}`}
                              {firstListeners > 0 ? (
                                <span className={styles.tipSub}>
                                  {`${Math.round((c.listeners / firstListeners) * 100)}% от первой главы`}
                                </span>
                              ) : null}
                            </>
                          )}
                        />
                      }
                    />
                    <Bar dataKey="listeners" fill="rgba(222, 97, 97, 0.35)" radius={[3, 3, 0, 0]} maxBarSize={24} isAnimationActive={false} />
                    <Bar dataKey="finished" fill="var(--accent)" radius={[3, 3, 0, 0]} maxBarSize={24} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
                <details className={styles.tableToggle}>
                  <summary>{'Таблица по главам'}</summary>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>{'Глава'}</th>
                        <th className={styles.num}>{'Начали'}</th>
                        <th className={styles.num}>{'Дослушали'}</th>
                        <th className={styles.num}>{'Доля дослушавших'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {chapters.map((c) => (
                        <tr key={c.id}>
                          <td>{`${chapterLabel(c)}${c.name ? ` · ${c.name}` : ''}`}</td>
                          <td className={styles.num}>{formatCount(c.listeners)}</td>
                          <td className={styles.num}>{formatCount(c.finished)}</td>
                          <td className={styles.num}>
                            {c.listeners > 0 ? `${Math.round((c.finished / c.listeners) * 100)}%` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}
