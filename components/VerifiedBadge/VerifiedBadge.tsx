'use client';

import { BadgeCheck } from 'lucide-react';
import styles from './VerifiedBadge.module.css';

export default function VerifiedBadge({
  title = 'Личность подтверждена администрацией',
}: {
  title?: string;
}) {
  return (
    <span className={styles.badge} title={title} aria-label={title}>
      <BadgeCheck size={16} aria-hidden="true" />
    </span>
  );
}
