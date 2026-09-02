import { Hammer } from 'lucide-react';
import Badge from '@/components/UserBadges/Badges/Badges';
import type { Badge as BadgeData } from '@/lib/types';
import styles from './UserBadges.module.css';

export default function UserBadges({
  user,
  size = 21,
  className = '',
}: {
  user?: {
    badges?: BadgeData[];
    is_banned?: boolean;
  } | null;
  size?: number;
  className?: string;
}) {
  const badges = user?.badges ?? [];
  const isBanned = !!user?.is_banned;

  if (badges.length === 0 && !isBanned) return null;

  return (
    <span className={`${styles.wrap} ${className}`}>
      {isBanned ? (
        <span className={styles.banned} title="Заблокирован" aria-label="Заблокирован">
          <Hammer size={size} fill="currentColor" aria-hidden="true" />
        </span>
      ) : null}
      {badges.map((badge) => (
        <Badge key={badge.id} badge={badge} size={size} />
      ))}
    </span>
  );
}
