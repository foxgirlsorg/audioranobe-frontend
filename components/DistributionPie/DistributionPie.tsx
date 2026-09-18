'use client';

import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import styles from './DistributionPie.module.css';

export interface DistributionSlice {
  label: string;
  value: number;
  color: string;
}

function formatPct(value: number, total: number): string {
  if (total <= 0) return '0%';
  return `${Math.round((value / total) * 100)}%`;
}

/** Caller is expected to only render this once `slices` has at least one entry. */
export default function DistributionPie({ title, slices }: { title: string; slices: DistributionSlice[] }) {
  const total = slices.reduce((sum, s) => sum + s.value, 0);

  return (
    <div className={`glass-panel ${styles.card}`}>
      <span className="eyebrow">{title}</span>
      <div className={styles.body}>
        <div className={styles.pieBox}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={slices} dataKey="value" nameKey="label" innerRadius="62%" outerRadius="100%" paddingAngle={2} stroke="none">
                {slices.map((s) => (
                  <Cell key={s.label} fill={s.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className={styles.legend}>
          {slices.map((s) => (
            <li key={s.label} className={styles.legendItem} style={{ background: s.color }}>
              <span>{s.label}</span>
              <span>{formatPct(s.value, total)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
