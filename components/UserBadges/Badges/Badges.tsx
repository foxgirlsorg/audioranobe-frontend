import styles from './Badges.module.css';

export type BadgeKey = 'admin' | 'moderator' | 'developer';

function BadgeIcon({ badge, size }: { badge: BadgeKey; size: number }) {
  if (badge === 'developer') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="m8 8-4 4 4 4M16 8l4 4-4 4" />
      </svg>
    );
  }

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2 4 5v6c0 5 3.4 8.6 8 10 4.6-1.4 8-5 8-10V5z" />
      <path
        d="m9 12 2 2 4-4"
        fill="none"
        style={{ stroke: 'var(--bg)' }}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Badge({
  badge,
  title,
  size = 21,
  className = '',
}: {
  badge: BadgeKey;
  title: string;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={`${styles.badge} ${styles[badge]} ${className}`}
      title={title}
      aria-label={title}
    >
      <BadgeIcon badge={badge} size={size} />
    </span>
  );
}
