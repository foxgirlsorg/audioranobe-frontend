'use client';

import styles from './RatingBars.module.css';

export function RatingBars({ distribution }: { distribution: Record<string, number> }) {
  const rows: { v: number; n: number }[] = [];
  for (let v = 10; v >= 1; v--) {
    rows.push({ v, n: Number(distribution?.[String(v)] ?? 0) });
  }
  const max = Math.max(1, ...rows.map((r) => r.n));

  return (
    <div className={styles.bars}>
      {rows.map((r) => (
        <div key={r.v} className={styles.row} title={`${r.n} × ${r.v}`}>
          <span className={styles.label}>{r.v}</span>
          <div className={styles.track}>
            <div className={styles.fill} style={{ width: `${(r.n / max) * 100}%` }} />
          </div>
          <span className={styles.count}>{r.n}</span>
        </div>
      ))}
    </div>
  );
}

export default RatingBars;
