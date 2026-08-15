import type { PresenceStatus } from '@/lib/types';
import { presenceLabel, presenceLabelCompact } from '@/lib/format';
import styles from './PresenceLabel.module.css';

/**
 * Presence text. Shows the full label («был(а) в сети …») on desktop and
 * switches to a compact form on mobile (≤768px), where the offline prefix is
 * replaced with COMPACT_OFFLINE_PREFIX. Title always carries the full label.
 */
export default function PresenceLabel({
  status,
  lastSeenAt,
  className = '',
}: {
  status: PresenceStatus;
  lastSeenAt?: string | null;
  className?: string;
}) {
  const full = presenceLabel(status, lastSeenAt);
  return (
    <span className={className} title={full}>
      <span className={styles.full}>{full}</span>
      <span className={styles.compact}>{presenceLabelCompact(status, lastSeenAt)}</span>
    </span>
  );
}
