'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { X, Bell } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { GROUPS, type CountKey } from '@/app/mod/navGroups';
import styles from './ModAlert.module.css';

const COOKIE = 'mod_alert_hidden';
const WINDOW_SEC = 2 * 60 * 60;

const COUNTABLE = GROUPS.flatMap((g) => g.tabs).filter(
  (t): t is typeof t & { countKey: CountKey } => !!t.countKey
);

function lastHidden(): number {
  const m = document.cookie.match(/(?:^|;\s*)mod_alert_hidden=(\d+)/);
  return m ? Number(m[1]) : 0;
}

function due(): boolean {
  return Date.now() / 1000 - lastHidden() >= WINDOW_SEC;
}

type Counts = Partial<Record<CountKey, number>>;

export default function ModAlert() {
  const { can } = useAuth();
  const eligible = can('mod.panel');
  const [items, setItems] = useState<{ href: string; label: string; count: number }[] | null>(null);
  const checking = useRef(false);

  const check = useCallback(() => {
    if (!eligible || checking.current) return;
    if (document.visibilityState !== 'visible' || !due()) return;
    checking.current = true;
    api<Counts>('/mod/dashboard')
      .then((counts) => {
        const list = COUNTABLE.filter((t) => !t.perm || can(t.perm))
          .map((t) => ({ href: t.href, label: t.label, count: counts[t.countKey] ?? 0 }))
          .filter((i) => i.count > 0);
        if (list.length) setItems(list);
        else checking.current = false; // nothing waiting — let a later focus re-check
      })
      .catch(() => {
        checking.current = false;
      });
  }, [eligible, can]);

  useEffect(() => {
    if (!eligible) return;
    check();
    document.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);
    return () => {
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('focus', check);
    };
  }, [eligible, check]);

  if (!items) return null;

  const hide = () => {
    document.cookie = `${COOKIE}=${Math.floor(Date.now() / 1000)}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    setItems(null);
  };

  return (
    <div className={`glass-panel ${styles.card}`} role="status" aria-label="Ждёт модерации">
      <div className={styles.head}>
        <Bell size={15} className={styles.bell} aria-hidden="true" />
        <span className={styles.title}>{'Ждёт вашего внимания'}</span>
        <button type="button" className={styles.close} onClick={hide} aria-label="Скрыть">
          <X size={15} />
        </button>
      </div>
      <ul className={styles.list}>
        {items.map((i) => (
          <li key={i.href}>
            <Link href={i.href} className={styles.row}>
              <span className={styles.label}>{i.label}</span>
              <span className={styles.count}>{i.count > 99 ? '99+' : i.count}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
