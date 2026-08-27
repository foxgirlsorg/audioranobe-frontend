'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { X, Sparkles } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { Recap } from '@/lib/types';
import styles from './RecapAlert.module.css';

const STORAGE_KEY = 'audioranobe_recap_alert_month';
const MIN_ACCOUNT_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const MIN_LISTEN_SECONDS = 10 * 60;

function monthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}`;
}

export default function RecapAlert() {
  const { user, loading } = useAuth();
  const [recap, setRecap] = useState<Recap | null>(null);

  useEffect(() => {
    if (loading || !user) return;
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(STORAGE_KEY);
    } catch {
    }
    if (stored === monthKey()) return;
    if (Date.now() - new Date(user.created_at).getTime() < MIN_ACCOUNT_AGE_MS) return;

    api<Recap>('/me/recap')
      .then((r) => {
        if (r.total_seconds >= MIN_LISTEN_SECONDS) {
          setRecap(r);
          try {
            window.localStorage.setItem(STORAGE_KEY, monthKey());
          } catch {
          }
        }
      })
      .catch(() => {
      });
  }, [loading, user]);

  if (!recap) return null;

  const hide = () => setRecap(null);

  return (
    <div className={styles.card} role="status" aria-label="Итоги месяца готовы">
      <span className={styles.glow} aria-hidden="true" />
      <button type="button" className={styles.close} onClick={hide} aria-label="Скрыть">
        <X size={20} />
      </button>
      <div className={styles.head}>
        <Sparkles size={18} className={styles.sparkle} aria-hidden="true" />
        <span className={styles.title}>Итоги месяца готовы!</span>
      </div>
      <Link href="/me/recap" className={styles.cta} onClick={hide}>
        Смотреть итоги
      </Link>
    </div>
  );
}
