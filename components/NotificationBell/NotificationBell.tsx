'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useAway, scalePoll } from '@/lib/presence';
import { timeAgo } from '@/lib/format';
import type { Notification, Paginated } from '@/lib/types';
import styles from './NotificationBell.module.css';

const POLL_MS = 30_000;

export default function NotificationBell() {
  const router = useRouter();
  const { user } = useAuth();
  const away = useAway();

  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[] | null>(null);
  const [loading, setLoading] = useState(false);

  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!user) {
      setCount(0);
      return;
    }
    let alive = true;
    const load = () => {
      api<{ count: number }>('/me/notifications/unread-count')
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
  }, [user, away]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const loadLatest = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<Paginated<Notification>>('/me/notifications', {
        params: { per_page: 10, unread: 1 },
      });
      setItems(res.items);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleOpen = () => {
    const next = !open;
    setOpen(next);
    if (next) void loadLatest();
  };

  const markAllRead = async () => {
    try {
      await api('/me/notifications/read', { method: 'POST', body: {} });
      setCount(0);
      setItems([]);
    } catch {
    }
  };

  const onItemClick = (n: Notification) => {
    if (!n.is_read) {
      api('/me/notifications/read', { method: 'POST', body: { ids: [n.id] } }).catch(() => {});
      setCount((c) => Math.max(0, c - 1));
      setItems((prev) => (prev ? prev.filter((x) => x.id !== n.id) : prev));
    }
    if (n.link) {
      setOpen(false);
      router.push(n.link);
    }
  };

  if (!user) return null;

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={styles.bellBtn}
        onClick={toggleOpen}
        aria-label={
          count > 0 ? `Уведомления (непрочитанных: ${count})` : 'Уведомления'
        }
        aria-expanded={open}
      >
        <Bell />
        {count > 0 && (
          <span className={styles.badge}>{count > 99 ? '99+' : count}</span>
        )}
      </button>

      {open && (
        <div className={styles.menu}>
          <div className={styles.head}>
            <span className={styles.headLabel}>{'Уведомления'}</span>
            <button
              type="button"
              className={styles.markAll}
              onClick={markAllRead}
              disabled={count === 0}
            >
              <CheckCheck aria-hidden="true" />
              {'Прочитать все'}
            </button>
          </div>

          <div className={styles.list}>
            {loading && <div className={styles.empty}>{'Загрузка…'}</div>}
            {!loading && items && items.length === 0 && (
              <div className={styles.empty}>{'Непрочитанных уведомлений нет.'}</div>
            )}
            {!loading &&
              items &&
              items.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  className={`${styles.item} ${styles.itemUnread}`}
                  onClick={() => onItemClick(n)}
                >
                  <span className={styles.dot} aria-hidden="true" />
                  <span className={styles.itemBody}>
                    <span className={styles.itemText}>{n.body}</span>
                    <span className={styles.itemTime}>{timeAgo(n.created_at)}</span>
                  </span>
                </button>
              ))}
          </div>

          <Link
            href="/me/notifications"
            className={styles.footerLink}
            onClick={() => setOpen(false)}
          >
            {'Все уведомления'}
          </Link>
        </div>
      )}
    </div>
  );
}
