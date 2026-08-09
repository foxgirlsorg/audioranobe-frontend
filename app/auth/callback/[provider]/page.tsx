'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';
import { api } from '@/lib/api';
import { errMsg } from '@/lib/toast';
import { useAuth } from '@/lib/auth';
import type { AuthProvider, Identity, Me } from '@/lib/types';
import Spinner from '@/components/Spinner/Spinner';
import { OAUTH_MODE_KEY } from '@/components/ProviderAuth/ProviderAuth';
import styles from './page.module.css';

export default function OAuthCallbackPage() {
  const params = useParams<{ provider: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const { adoptSession, refresh } = useAuth();

  const [error, setError] = useState<string | null>(null);
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    const provider = String(params?.provider ?? '') as AuthProvider;
    const code = search?.get('code') ?? '';
    const state = search?.get('state') ?? '';
    const denied = search?.get('error');

    if (denied) {
      setError('Вход отменён.');
      return;
    }
    if (!code || !state) {
      setError('Ссылка неполная — попробуйте войти заново.');
      return;
    }

    const mode =
      typeof window !== 'undefined' ? sessionStorage.getItem(OAUTH_MODE_KEY) : null;
    sessionStorage.removeItem(OAUTH_MODE_KEY);

    (async () => {
      try {
        const res = await api<{
          token?: string;
          user?: Me;
          ok?: boolean;
          identities?: Identity[];
        }>(`/auth/oauth/${provider}/callback`, {
          method: 'POST',
          body: { code, state },
        });

        if (res.token && res.user) {
          adoptSession(res.user);
          router.replace(res.user.needs_setup ? '/auth/setup' : '/');
          return;
        }
        await refresh();
        router.replace('/me/settings');
      } catch (e) {
        setError(errMsg(e));
      }
    })();
  }, [params, search, router, adoptSession, refresh]);

  if (error) {
    return (
      <div className={styles.wrap}>
        <div className={`glass-panel ${styles.panel}`}>
          <ShieldAlert size={26} className={styles.icon} aria-hidden="true" />
          <h1 className={styles.title}>{'Не удалось войти'}</h1>
          <p className={styles.text}>{error}</p>
          <Link href="/auth/login" className="btn btn-primary">
            {'Вернуться ко входу'}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.loading}>
        <Spinner />
        <p className={styles.text}>{'Завершаем вход…'}</p>
      </div>
    </div>
  );
}
