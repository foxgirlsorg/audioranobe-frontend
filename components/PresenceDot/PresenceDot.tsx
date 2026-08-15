import type { CSSProperties } from 'react';
import type { PresenceStatus } from '@/lib/types';
import { presenceLabel } from '@/lib/format';
import styles from './PresenceDot.module.css';

/**
 * The status dot: green (online), gray (offline). Offline is hidden by
 * default — callers that want a persistent placeholder pass showOffline.
 * Designed to sit as an overlay on an avatar (position it via the parent) or
 * inline next to a label.
 */
export default function PresenceDot({
  status,
  lastSeenAt,
  size,
  ring = true,
  showOffline = false,
  className = '',
}: {
  status: PresenceStatus;
  lastSeenAt?: string | null;
  size?: number;
  /** Draw a background-colored ring so the dot reads over an avatar. */
  ring?: boolean;
  showOffline?: boolean;
  className?: string;
}) {
  if (status === 'offline' && !showOffline) return null;
  const style: CSSProperties = { width: size, height: size };
  return (
    <span
      className={`${styles.dot} ${styles[status]} ${ring ? styles.ring : ''} ${className}`}
      style={style}
      title={presenceLabel(status, lastSeenAt)}
      aria-label={presenceLabel(status, lastSeenAt)}
    />
  );
}
