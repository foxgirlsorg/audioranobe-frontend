'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, XCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { errMsg } from '@/lib/toast';
import Spinner from '@/components/Spinner/Spinner';
import styles from './page.module.css';

function VerifyInner() {
  const { refresh } = useAuth();
  const [state, setState] = useState<'working' | 'done' | 'failed'>('working');
  const [error, setError] = useState('');

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token') ?? '';
    if (!token) {
      setState('failed');
      setError('В ссылке нет кода подтверждения.');
      return;
    }
    let alive = true;
    api('/auth/verify', { method: 'POST', body: { token } })
      .then(async () => {
        if (!alive) return;
        setState('done');
        try {
          await refresh();
        } catch {
        }
      })
      .catch((e) => {
        if (!alive) return;
        setState('failed');
        setError(errMsg(e));
      });
    return () => {
      alive = false;
    };
  }, [refresh]);

  return (
    <div className={styles.wrap}>
      <div className={`glass-panel ${styles.card}`}>
        {state === 'working' ? (
          <>
            <Spinner size={30} />
            <p className={styles.text}>{'Подтверждаем почту…'}</p>
          </>
        ) : state === 'done' ? (
          <>
            <CheckCircle2 size={34} className={styles.ok} />
            <h1 className={styles.title}>{'Почта подтверждена'}</h1>
            <p className={styles.text}>{'Спасибо! Адрес привязан к вашему аккаунту.'}</p>
            <Link href="/" className="btn btn-primary">
              {'На главную'}
            </Link>
          </>
        ) : (
          <>
            <XCircle size={34} className={styles.bad} />
            <h1 className={styles.title}>{'Не удалось подтвердить'}</h1>
            <p className={styles.text}>{error}</p>
            <Link href="/me/settings" className="btn btn-ghost">
              {'Отправить ссылку заново'}
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={null}>
      <VerifyInner />
    </Suspense>
  );
}
