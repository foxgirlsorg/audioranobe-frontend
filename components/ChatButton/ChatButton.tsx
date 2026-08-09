'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useAway, scalePoll } from '@/lib/presence';
import styles from './ChatButton.module.css';

const POLL_MS = 20_000;

/**
 * Navbar entry point for direct messages: an icon linking to /me/chat with a
 * count badge. DMs deliberately do NOT go through the notification system, so
 * this polls its own unread-count endpoint. Refetches on navigation so opening
 * a chat clears the badge promptly.
 */
export default function ChatButton() {
  const { user } = useAuth();
  const away = useAway();
  const pathname = usePathname();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user) {
      setCount(0);
      return;
    }
    let alive = true;
    const load = () => {
      api<{ count: number }>('/me/chat/unread-count')
        .then((r) => {
          if (alive) setCount(r.count);
        })
        .catch(() => {});
    };
    load();
    const iv = window.setInterval(load, scalePoll(POLL_MS, away));
    return () => {
      alive = false;
      window.clearInterval(iv);
    };
  }, [user, pathname, away]);

  if (!user) return null;

  return (
    <Link
      href="/me/chat"
      className={styles.btn}
      aria-label={count > 0 ? `Сообщения (непрочитанных: ${count})` : 'Сообщения'}
    >
      <MessageCircle />
      {count > 0 && <span className={styles.badge}>{count > 99 ? '99+' : count}</span>}
    </Link>
  );
}
