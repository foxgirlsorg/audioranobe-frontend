'use client';

import Link from 'next/link';
import type { CSSProperties } from 'react';
import { User as UserIcon } from 'lucide-react';
import styles from './UserAvatar.module.css';

function initialsOf(username: string): string {
  const parts = username.split(/[_\-.]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return username.slice(0, 2).toUpperCase();
}

export function UserAvatar({
  user,
  size,
}: {
  user: { username: string; avatar_url?: string | null } | null;
  size: number;
}) {
  const dim: CSSProperties = {
    width: size,
    height: size,
    fontSize: Math.max(9, Math.round(size * 0.34)),
  };

  if (!user) {
    return (
      <span className={`${styles.avatar} ${styles.deleted}`} style={dim} title="Удалённый пользователь">
        <UserIcon size={Math.max(12, Math.round(size * 0.5))} />
      </span>
    );
  }

  return (
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
}

export default UserAvatar;
