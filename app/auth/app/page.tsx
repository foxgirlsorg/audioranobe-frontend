'use client';

import { useEffect, useState } from 'react';
import { ChevronRight, ShieldAlert } from 'lucide-react';
import { api } from '@/lib/api';
import { errMsg } from '@/lib/toast';
import { useAuth } from '@/lib/auth';
import Spinner from '@/components/Spinner/Spinner';
import UserAvatar from '@/components/UserAvatar/UserAvatar';
import UserBadges from '@/components/UserBadges/UserBadges';
import styles from '../callback/[provider]/page.module.css';
import own from './page.module.css';

interface Pending {
  provider: string;
  provider_name: string;
  mode: string;
  url: string;
}

/**
 * Opened by the Android app in a Custom Tab before a third-party sign-in. When
 * this browser already has a site session, offer to hand that account to the
 * app instead; otherwise go straight to the provider.
 */
export default function AppAuthPage() {
  const { user, loading } = useAuth();
  const [state, setState] = useState('');
  const [pending, setPending] = useState<Pending | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get('state') ?? '';
    setState(s);
    api<Pending>('/auth/oauth/pending', { params: { state: s } })
      .then(setPending)
      .catch((e) => setError(errMsg(e)));
  }, []);

  const offerSession = !!pending && pending.mode === 'login' && !!user;

  useEffect(() => {
    if (pending && !loading && !offerSession) window.location.replace(pending.url);
  }, [pending, loading, offerSession]);

  async function continueAsUser() {
    const pkg = /^app~([^~]+)~/.exec(state)?.[1];
    if (!pkg) return;
    setBusy(true);
    try {
      const { handoff } = await api<{ handoff: string }>('/auth/oauth/handoff', { method: 'POST', body: { state } });
      window.location.href = `intent://oauth/session?handoff=${handoff}#Intent;scheme=audioranobe;package=${pkg};end`;
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <div className={styles.wrap}>
        <div className={`glass-panel ${styles.panel}`}>
          <ShieldAlert size={26} className={styles.icon} aria-hidden="true" />
          <h1 className={styles.title}>{'Не удалось войти'}</h1>
          <p className={styles.text}>{error}</p>
        </div>
      </div>
    );
  }

  if (!pending || !offerSession || !user) {
    return (
      <div className={styles.wrap}>
        <div className={styles.loading}>
          <Spinner />
          <p className={styles.text}>{'Открываем вход…'}</p>
        </div>
      </div>
    );
  }

  const name = user.display_name || user.username;
  return (
    <div className={styles.wrap}>
      <div className={`glass-panel ${styles.panel}`}>
        <h1 className={styles.title}>{'Вход в приложение'}</h1>
        <p className={styles.text}>{'В этом браузере вы уже вошли. Продолжить с этим аккаунтом?'}</p>
        <div className={own.actions}>
          <button type="button" className={own.account} disabled={busy} onClick={continueAsUser}>
            <UserAvatar user={user} size={52} />
            <span className={own.meta}>
              <span className={own.name}>
                <span className={own.nameText}>{name}</span>
                <UserBadges user={user} size={16} />
              </span>
              <span className={own.handle}>{busy ? 'Входим…' : `Продолжить как @${user.username}`}</span>
            </span>
            <ChevronRight size={18} className={own.chevron} aria-hidden="true" />
          </button>
          <a href={pending.url} className="btn btn-ghost">
            {`Войти через ${pending.provider_name}`}
          </a>
        </div>
      </div>
    </div>
  );
}
