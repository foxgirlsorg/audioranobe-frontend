'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatCount } from '@/lib/format';
import { LIBRARY_STATUS_LABELS, LIBRARY_STATUS_VALUES } from '@/lib/types';
import type { LibraryStatus, StatsBreakdown, StatsDay } from '@/lib/types';
import styles from './StatsBlocks.module.css';

/** Building blocks shared by the title and narrator stats dashboards. */
export { styles as statsStyles };

const RANGES = [7, 30, 90, 365];

/* Validated categorical slots 1–4 (dark surface), fixed order = list order. */
const LIST_COLORS: Record<LibraryStatus, string> = {
  planning: '#3987e5',
  in_progress: '#d95926',
  completed: '#199e70',
  dropped: '#c98500',
};

export const AXIS_TICK = { fill: 'var(--text-muted)', fontSize: 11 };
export const GRID = 'rgba(255, 255, 255, 0.06)';
export const CURSOR = { fill: 'rgba(255, 255, 255, 0.04)' };

export const fmtHours = (sec: number) => {
  const h = sec / 3600;
  return h >= 10 ? `${Math.round(h)} ч` : h >= 1 ? `${h.toFixed(1)} ч` : `${Math.round(sec / 60)} мин`;
};

const fmtDay = (d: string) => {
  const [, m, day] = d.split('-');
  return `${Number(day)}.${m}`;
};

export const sumSeries = (series: StatsDay[], key: keyof StatsDay) =>
  series.reduce((n, d) => n + Number(d[key] ?? 0), 0);

export function Tip({
  active,
  payload,
  render,
}: {
  active?: boolean;
  payload?: { payload: unknown }[];
  render: (row: never) => React.ReactNode;
}) {
  if (!active || !payload?.length) return null;
  return <div className={styles.tip}>{render(payload[0].payload as never)}</div>;
}

/**
 * The dashboards fetch twice their window; this splits it into the current
 * window (last `days`) and the one before it.
 */
export function splitSeries(series: StatsDay[], days: number): [StatsDay[], StatsDay[]] {
  return [series.slice(-days), series.slice(0, Math.max(0, series.length - days))];
}

/** Change vs the previous window in %, or null when there is nothing to compare with. */
export function trend(cur: StatsDay[], prev: StatsDay[], key: keyof StatsDay): number | null {
  const a = sumSeries(cur, key);
  const b = sumSeries(prev, key);
  if (b === 0) return null;
  return Math.round(((a - b) / b) * 100);
}

export function Kpi({ value, label, hint, change }: { value: string; label: string; hint?: string; change?: number | null }) {
  return (
    <div className={styles.kpi}>
      <span className={styles.kpiValue}>{value}</span>
      <span className={styles.kpiLabel}>{label}</span>
      {hint ? <span className={styles.kpiHint}>{hint}</span> : null}
      {change != null ? (
        <span className={change >= 0 ? styles.trendUp : styles.trendDown}>
          {`${change >= 0 ? '↑' : '↓'} ${Math.abs(change)}% к прошлому периоду`}
        </span>
      ) : null}
    </div>
  );
}

export function RangeSwitch({ days, onChange }: { days: number; onChange: (d: number) => void }) {
  return (
    <header className={styles.head}>
      <span className="eyebrow">{'За период'}</span>
      <div className={styles.ranges} role="tablist" aria-label={'Период'}>
        {RANGES.map((r) => (
          <button
            key={r}
            type="button"
            role="tab"
            aria-selected={days === r}
            className={days === r ? `${styles.range} ${styles.rangeActive}` : styles.range}
            onClick={() => onChange(r)}
          >
            {r === 365 ? 'Год' : `${r} дн.`}
          </button>
        ))}
      </div>
    </header>
  );
}

export function DayBars({
  series,
  dataKey,
  format,
  height = 220,
}: {
  series: StatsDay[];
  dataKey: keyof StatsDay;
  format: (v: number) => string;
  height?: number;
}) {
  const data = series.map((d) => ({ day: d.day, value: Number(d[dataKey] ?? 0) }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap={series.length > 60 ? 1 : '18%'}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="day" tickFormatter={fmtDay} axisLine={false} tickLine={false} tick={AXIS_TICK} minTickGap={24} />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={AXIS_TICK}
          width={44}
          allowDecimals={false}
          tickFormatter={(v: number) => (dataKey === 'listen_seconds' ? `${Math.round(v / 3600)}` : formatCount(v))}
        />
        <Tooltip
          cursor={CURSOR}
          content={
            <Tip
              render={(row: { day: string; value: number }) => (
                <>
                  <span className={styles.tipHead}>{fmtDay(row.day)}</span>
                  {format(row.value)}
                </>
              )}
            />
          }
        />
        <Bar dataKey="value" fill="var(--accent)" radius={[4, 4, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Listening time and listeners by day, full width. */
export function ListeningCharts({ series }: { series: StatsDay[] }) {
  return (
    <>
      <section className={`glass-panel ${styles.panel}`}>
        <h2 className={styles.panelTitle}>
          {'Время прослушивания по дням, ч'}
          <span className={styles.panelValue}>{fmtHours(sumSeries(series, 'listen_seconds'))}</span>
        </h2>
        <DayBars series={series} dataKey="listen_seconds" format={fmtHours} height={240} />
      </section>
      <section className={`glass-panel ${styles.panel}`}>
        <h2 className={styles.panelTitle}>{'Слушатели по дням'}</h2>
        <DayBars series={series} dataKey="listeners" format={(v) => `${formatCount(v)} слуш.`} />
      </section>
    </>
  );
}

/** Small multiples: one mini bar chart per daily count. */
export function MiniCharts({ series, items }: { series: StatsDay[]; items: { key: keyof StatsDay; label: string }[] }) {
  return (
    <section className={styles.minis}>
      {items.map((m) => (
        <div key={m.key} className={`glass-panel ${styles.panel}`}>
          <h2 className={styles.panelTitle}>
            {m.label}
            <span className={styles.panelValue}>{formatCount(sumSeries(series, m.key))}</span>
          </h2>
          <DayBars series={series} dataKey={m.key} format={(v) => formatCount(v)} height={110} />
        </div>
      ))}
    </section>
  );
}

export const listTotal = (lists: StatsBreakdown['lists']) => LIBRARY_STATUS_VALUES.reduce((n, k) => n + lists[k], 0);

/** Library lists breakdown and the 1–10 rating distribution, side by side. */
export function ListsAndRatings({
  lists,
  distribution,
  avg,
}: {
  lists: StatsBreakdown['lists'];
  distribution: Record<string, number>;
  avg: number | null;
}) {
  const total = listTotal(lists);
  const ratingData = Array.from({ length: 10 }, (_, i) => ({ score: i + 1, n: distribution[String(i + 1)] ?? 0 }));
  return (
    <section className={styles.split}>
      <div className={`glass-panel ${styles.panel}`}>
        <h2 className={styles.panelTitle}>
          {'В списках у пользователей'}
          <span className={styles.panelValue}>{formatCount(total)}</span>
        </h2>
        {total === 0 ? (
          <p className={styles.empty}>{'Пока ни у кого нет в списках.'}</p>
        ) : (
          <>
            <div className={styles.stack} aria-hidden="true">
              {LIBRARY_STATUS_VALUES.map((k) =>
                lists[k] > 0 ? <span key={k} style={{ flexGrow: lists[k], background: LIST_COLORS[k] }} /> : null
              )}
            </div>
            <table className={styles.legend}>
              <tbody>
                {LIBRARY_STATUS_VALUES.map((k) => (
                  <tr key={k}>
                    <td>
                      <span className={styles.swatch} style={{ background: LIST_COLORS[k] }} />
                      {LIBRARY_STATUS_LABELS[k]}
                    </td>
                    <td className={styles.num}>{formatCount(lists[k])}</td>
                    <td className={styles.pct}>{`${Math.round((lists[k] / total) * 100)}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      <div className={`glass-panel ${styles.panel}`}>
        <h2 className={styles.panelTitle}>
          {'Распределение оценок'}
          {avg != null ? <span className={styles.panelValue}>{`${avg.toFixed(1)}★`}</span> : null}
        </h2>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={ratingData} margin={{ top: 18, right: 4, bottom: 0, left: 4 }} barCategoryGap="18%">
            <XAxis dataKey="score" axisLine={false} tickLine={false} tick={AXIS_TICK} />
            <Tooltip
              cursor={CURSOR}
              content={
                <Tip
                  render={(row: { score: number; n: number }) => (
                    <>
                      <span className={styles.tipHead}>{`Оценка ${row.score}`}</span>
                      {`${formatCount(row.n)} польз.`}
                    </>
                  )}
                />
              }
            />
            <Bar
              dataKey="n"
              fill="var(--accent)"
              radius={[4, 4, 0, 0]}
              maxBarSize={32}
              label={{ position: 'top', fill: 'var(--text-secondary)', fontSize: 11 }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
