import type { Badge as BadgeData } from '@/lib/types';
import styles from './Badges.module.css';

export default function Badge({
  badge,
  size = 21,
  className = '',
}: {
  badge: BadgeData;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={`${styles.badge} ${className}`}
      style={{ width: size, height: size }}
      title={badge.name}
      aria-label={badge.name}
      dangerouslySetInnerHTML={{ __html: badge.svg }}
    />
  );
}
