'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useBadges } from '@/lib/badges';
import { timeAgo } from '@/lib/format';
import { useAnimatedPresence } from '@/lib/useAnimatedPresence';
import type { Notification, Paginated } from '@/lib/types';
import styles from './NotificationBell.module.css';

export default function NotificationBell() {
  const router = useRouter();
  const { user } = useAuth();
  // Count comes from the shared BadgesProvider poll; patch/refresh keep it in
  // sync after the user reads notifications.
  const { notifications: count, patch, refresh } = useBadges();

  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[] | null>(null);
  const [loading, setLoading] = useState(false);
  const menuMounted = useAnimatedPresence(open, 140);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const bellBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        bellBtnRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
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
    patch({ notifications: 0 });
    setItems([]);
    try {
      await api('/me/notifications/read', { method: 'POST', body: {} });
    } catch {
      refresh();
    }
  };

  const onItemClick = (n: Notification) => {
    if (!n.is_read) {
      api('/me/notifications/read', { method: 'POST', body: { ids: [n.id] } }).catch(() => refresh());
      patch((b) => ({ notifications: Math.max(0, b.notifications - 1) }));
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
        ref={bellBtnRef}
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

      {menuMounted && (
        <div className={`${styles.menu} ${open ? '' : styles.menuOut}`}>
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
