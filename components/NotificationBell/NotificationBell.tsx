'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bell, Check, CheckCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useBadges } from '@/lib/badges';
import { timeAgo } from '@/lib/format';
import { useAnimatedPresence } from '@/lib/useAnimatedPresence';
import type { Notification, Paginated } from '@/lib/types';
import styles from './NotificationBell.module.css';

export default function NotificationBell({ scrolled = false }: { scrolled?: boolean }) {
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
  const menuRef = useRef<HTMLDivElement | null>(null);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Portaled to <body> so its own backdrop-filter samples the real page
  // behind it — nested inside the nav bar, it would instead sample the nav's
  // own blurred backdrop once `.scrolled` gives the nav a backdrop-filter of
  // its own, making the menu's blur look like it "stopped working".
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  useLayoutEffect(() => {
    if (!open || !wrapRef.current) return;
    const r = wrapRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + (scrolled ? 25 : 10), right: window.innerWidth - r.right });
  }, [open, scrolled]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
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

  const markItemRead = (n: Notification) => {
    if (n.is_read) return;
    api('/me/notifications/read', { method: 'POST', body: { ids: [n.id] } }).catch(() => refresh());
    patch((b) => ({ notifications: Math.max(0, b.notifications - 1) }));
    setItems((prev) => (prev ? prev.filter((x) => x.id !== n.id) : prev));
  };

  const onItemClick = (n: Notification) => {
    markItemRead(n);
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

      {menuMounted && mounted && pos
        ? createPortal(
            <div
              ref={menuRef}
              className={`${styles.menu} ${open ? '' : styles.menuOut}`}
              style={{ top: pos.top, right: pos.right }}
            >
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
                <div key={n.id} className={`${styles.item} ${styles.itemUnread}`}>
                  <button
                    type="button"
                    className={styles.itemMain}
                    onClick={() => onItemClick(n)}
                  >
                    <span className={styles.dot} aria-hidden="true" />
                    <span className={styles.itemBody}>
                      <span className={styles.itemText}>{n.body}</span>
                      <span className={styles.itemTime}>{timeAgo(n.created_at)}</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    className={styles.markReadBtn}
                    onClick={() => markItemRead(n)}
                    title={'Отметить прочитанным'}
                    aria-label={'Отметить прочитанным'}
                  >
                    <Check size={18} />
                  </button>
                </div>
              ))}
          </div>

          <Link
            href="/me/notifications"
            className={styles.footerLink}
            onClick={() => setOpen(false)}
          >
            {'Все уведомления'}
          </Link>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
