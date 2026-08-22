import Badge, { BadgeKey } from '@/components/UserBadges/Badges/Badges';
import styles from './UserBadges.module.css';

export default function UserBadges({
                                     user,
                                     size = 21,
                                     className = '',
                                   }: {
  user?: {
    role?: string | null;
    is_developer?: boolean;
    is_donator?: boolean;
    is_banned?: boolean;
  } | null;
  size?: number;
  className?: string;
}) {
  const role = user?.role ?? null;
  const isDeveloper = !!user?.is_developer;
  const isDonator = !!user?.is_donator;
  const isBanned = !!user?.is_banned;
  const isStaff = role === 'moderator' || role === 'admin';

  if (!isStaff && !isDeveloper && !isDonator && !isBanned) return null;

  const badges: { key: BadgeKey; title: string }[] = [];

  if (isBanned) {
    badges.push({
      key: 'banned',
      title: 'Заблокирован',
    });
  }

  if (isStaff) {
    badges.push({
      key: role === 'admin' ? 'admin' : 'moderator',
      title: role === 'admin' ? 'Администратор' : 'Модератор',
    });
  }

  if (isDeveloper) {
    badges.push({
      key: 'developer',
      title: 'Разработчик',
    });
  }

  if (isDonator) {
    badges.push({
      key: 'donator',
      title: 'Донатер',
    });
  }

  return (
      <span className={`${styles.wrap} ${className}`}>
      {badges.map((badge) => (
          <Badge
              key={badge.key}
              badge={badge.key}
              title={badge.title}
              size={size}
          />
      ))}
    </span>
  );
}