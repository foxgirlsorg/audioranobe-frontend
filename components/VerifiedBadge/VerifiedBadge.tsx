'use client';

import { Check } from 'lucide-react';
import styles from './VerifiedBadge.module.css';

export default function VerifiedBadge({
  title = 'Личность подтверждена администрацией',
  size = 15,
  className = '',
}: {
  title?: string;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={className ? `${styles.badge} ${className}` : styles.badge}
      title={title}
      aria-label={title}
    >
      <Check size={size} strokeWidth={3} aria-hidden="true" />
    </span>
  );
}
