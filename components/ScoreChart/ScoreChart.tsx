'use client';

import { useState } from 'react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import type { ScoreStats } from '@/lib/types';
import styles from './ScoreChart.module.css';

type Metric = 'titles' | 'hours';

function CustomTooltip({ active, payload, metric }: { active?: boolean; payload?: { payload: { score: number; titles: number; hours: number } }[]; metric: Metric }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  const value = metric === 'titles' ? `${row.titles} книг` : `${row.hours} ч`;
  return (
    <div className={styles.tooltip}>
      <strong>{row.score}</strong> — {value}
    </div>
  );
}

export default function ScoreChart({ scores }: { scores: ScoreStats['scores'] }) {
  const [metric, setMetric] = useState<Metric>('titles');

  const data = Array.from({ length: 10 }, (_, i) => {
    const score = i + 1;
    const row = scores.find((s) => s.score === score);
    return { score, titles: row?.titles ?? 0, hours: row?.hours ?? 0 };
  });

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <span className="eyebrow">Оценки</span>
        <div className={styles.toggle}>
          <button
            type="button"
            className={metric === 'titles' ? `${styles.toggleBtn} ${styles.toggleBtnActive}` : styles.toggleBtn}
            onClick={() => setMetric('titles')}
          >
            Книг оценено
          </button>
          <button
            type="button"
            className={metric === 'hours' ? `${styles.toggleBtn} ${styles.toggleBtnActive}` : styles.toggleBtn}
            onClick={() => setMetric('hours')}
          >
            Часов прослушано
          </button>
        </div>
      </div>

      <div className={styles.chart}>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 20, right: 8, bottom: 0, left: 8 }} barCategoryGap="18%">
            <XAxis
              dataKey="score"
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
            />
            <Tooltip content={<CustomTooltip metric={metric} />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
            <Bar dataKey={metric} radius={[4, 4, 0, 0]} fill="var(--accent)" maxBarSize={36} label={{ position: 'top', fill: 'var(--text-secondary)', fontSize: 11 }} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
