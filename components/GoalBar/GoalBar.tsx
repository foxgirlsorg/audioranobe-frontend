'use client';

import Link from 'next/link';
import { PERIOD_LABEL, usd, type DonateGoal } from '@/lib/donate';
import styles from './GoalBar.module.css';

export default function GoalBar({ goal, compact = false }: { goal: DonateGoal; compact?: boolean }) {
  if (!goal.enabled) return null;

  const bar = (
    <div className={styles.track} role="progressbar" aria-valuenow={goal.pct} aria-valuemin={0} aria-valuemax={100}>
      <span className={styles.fill} style={{ width: `${goal.pct}%` }} />
    </div>
  );

  const label = (
    <span className={styles.figures}>
      {usd(goal.raised_cents)} <span className={styles.of}>/ {usd(goal.target_cents)}</span>
    </span>
  );

  if (compact) {
    return (
      <Link href="/donate" className={`${styles.wrap} ${styles.compact}`} title={goal.title || 'Цель сбора'}>
        <span className={styles.compactTop}>
          <span className={styles.title}>{goal.title || 'Цель сбора'}</span>
          {label}
        </span>
        {bar}
      </Link>
    );
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.top}>
        <span className={styles.title}>{goal.title || 'Цель сбора'}</span>
        <span className={styles.period}>{PERIOD_LABEL[goal.period]}</span>
      </div>
      {bar}
      <div className={styles.bottom}>
        {label}
        <span className={styles.pct}>{goal.pct}%</span>
      </div>
    </div>
  );
}
