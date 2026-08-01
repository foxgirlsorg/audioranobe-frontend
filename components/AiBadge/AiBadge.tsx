'use client';

import styles from './AiBadge.module.css';

export default function AiBadge({
  overlay = false,
  label = 'AI',
  title = 'Озвучено синтезированным голосом',
}: {
  overlay?: boolean;
  label?: string;
  title?: string;
}) {
  return (
    <span
      className={overlay ? `${styles.badge} ${styles.overlay}` : styles.badge}
      title={title}
      aria-label={title}
    >
      {label}
    </span>
  );
}
