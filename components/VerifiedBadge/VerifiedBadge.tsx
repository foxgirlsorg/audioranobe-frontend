'use client';

import { Check } from 'lucide-react';
import styles from './VerifiedBadge.module.css';

export default function VerifiedBadge({
  title = 'Личность подтверждена администрацией',
  size = 15,
}: {
  title?: string;
  size?: number;
}) {
  return (
    <span className={styles.badge} title={title} aria-label={title}>
      <Check size={size} strokeWidth={3} aria-hidden="true" />
    </span>
  );
}
