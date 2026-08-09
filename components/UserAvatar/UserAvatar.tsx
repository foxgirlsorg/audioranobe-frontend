'use client';

import Link from 'next/link';
import type { CSSProperties } from 'react';
import { User as UserIcon } from 'lucide-react';
import { initialsOf } from '@/lib/format';
import type { PresenceStatus } from '@/lib/types';
import PresenceDot from '@/components/PresenceDot/PresenceDot';
import styles from './UserAvatar.module.css';

export function UserAvatar({
  user,
  size,
  presence,
  lastSeenAt,
}: {
  user: { username: string; avatar_url?: string | null } | null;
  size: number;
  /** When set (and online/away), overlays a status dot at the corner. */
  presence?: PresenceStatus | null;
  lastSeenAt?: string | null;
}) {
  const dim: CSSProperties = {
    width: size,
    height: size,
    fontSize: Math.max(9, Math.round(size * 0.34)),
  };

  const inner = !user ? (
    <span className={`${styles.avatar} ${styles.deleted}`} style={dim} title="Удалённый пользователь">
      <UserIcon size={Math.max(12, Math.round(size * 0.5))} />
    </span>
  ) : (
    <Link
      href={`/user/${encodeURIComponent(user.username)}`}
      className={styles.avatar}
      style={dim}
      title={user.username}
    >
      {user.avatar_url ? (
        <img src={user.avatar_url} alt={user.username} className={styles.img} loading="lazy" />
      ) : (
        <span className={styles.initials}>{initialsOf(user.username)}</span>
      )}
    </Link>
  );

  // The avatar clips its own overflow, so the corner dot lives on a wrapper.
  if (presence && presence !== 'offline') {
    return (
      <span className={styles.wrap} style={{ width: size, height: size }}>
        {inner}
        <PresenceDot
          status={presence}
          lastSeenAt={lastSeenAt}
          size={Math.max(7, Math.round(size * 0.26))}
          className={styles.dot}
        />
      </span>
    );
  }

  return inner;
}

export default UserAvatar;
