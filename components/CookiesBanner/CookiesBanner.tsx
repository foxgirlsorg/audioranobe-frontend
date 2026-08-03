'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Cookie } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import type { Me } from '@/lib/types';
import styles from './CookiesBanner.module.css';

const STORAGE_KEY = 'audioranobe_cookies_accepted';

export default function CookiesBanner() {
  const { user, loading: authLoading, refresh } = useAuth();
  const [accepted, setAccepted] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });

  if (authLoading) return null;

  const alreadyAccepted = user ? user.accepted_cookies : accepted;

  if (alreadyAccepted) return null;

  const accept = async () => {
    if (user) {
      try {
        await api<Me>('/me/cookies', { method: 'POST' });
        await refresh();
      } catch {
        return;
      }
    } else {
      try {
        window.localStorage.setItem(STORAGE_KEY, '1');
      } catch {
      }
      setAccepted(true);
    }
  };

  return (
    <div className={styles.banner} role="region" aria-label="Использование cookie">
      <span className={styles.icon}>
        <Cookie size={16} />
      </span>
      <p className={styles.text}>
        Мы используем cookie-файлы, чтобы сайт работал корректно. Продолжая
        пользоваться AudioRanobe, вы соглашаетесь с{' '}
        <Link href="/legal/privacy" className={styles.link}>
          политикой конфиденциальности
        </Link>
        .
      </p>
      <button type="button" className={styles.accept} onClick={accept}>
        Понятно
      </button>
    </div>
  );
}
