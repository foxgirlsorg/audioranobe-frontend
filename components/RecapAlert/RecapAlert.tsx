'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { X, Sparkles } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { Recap } from '@/lib/types';
import styles from './RecapAlert.module.css';

export default function RecapAlert() {
  const { user, loading } = useAuth();
  const [recap, setRecap] = useState<Recap | null>(null);

  useEffect(() => {
    if (loading || !user) return;
    // Server decides eligibility and claims the month atomically — one
    // popup per calendar month no matter how many devices the user has.
    api<{ recap: Recap | null }>('/me/recap/alert')
      .then((r) => setRecap(r.recap))
      .catch(() => {
      });
  }, [loading, user]);

  if (!recap) return null;

  const hide = () => setRecap(null);

  return (
    <div className={`glass-panel ${styles.card}`} role="status" aria-label="Итоги месяца готовы">
      <div className={styles.head}>
        <Sparkles size={15} className={styles.sparkle} aria-hidden="true" />
        <span className={styles.title}>Итоги месяца готовы</span>
        <button type="button" className={styles.close} onClick={hide} aria-label="Скрыть">
          <X size={15} />
        </button>
      </div>
      <Link href="/me/recap" className={styles.cta} onClick={hide}>
        Смотреть итоги
      </Link>
    </div>
  );
}
