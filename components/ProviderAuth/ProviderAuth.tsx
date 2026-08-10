'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ExternalLink, X } from 'lucide-react';
import { TelegramIcon } from '@/components/SocialLinks/brands';
import { api } from '@/lib/api';
import { errMsg, useToast } from '@/lib/toast';
import { useAuth } from '@/lib/auth';
import { useConfig } from '@/lib/config';
import type { AuthProvider, Identity, Me } from '@/lib/types';
import Spinner from '@/components/Spinner/Spinner';
import styles from './ProviderAuth.module.css';

const LABELS: Record<AuthProvider, string> = {
  google: 'Google',
  discord: 'Discord',
  telegram: 'Telegram',
};

export const OAUTH_MODE_KEY = 'auralib.oauth.mode';

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.5 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47a5.5 5.5 0 0 1-2.4 3.62v3h3.87c2.26-2.09 3.56-5.17 3.56-8.86Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.94-2.91l-3.87-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.28v3.09A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29a7.2 7.2 0 0 1 0-4.58V6.62H1.28a12 12 0 0 0 0 10.76l3.99-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.43-3.43C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.28 6.62l3.99 3.09C6.22 6.86 8.87 4.75 12 4.75Z"
      />
    </svg>
  );
}

function DiscordMark() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="#5865F2">
      <path d="M20.32 4.37A19.8 19.8 0 0 0 15.43 3a13.8 13.8 0 0 0-.63 1.28 18.3 18.3 0 0 0-5.6 0A13.9 13.9 0 0 0 8.57 3 19.7 19.7 0 0 0 3.68 4.38C.57 9 .1 13.52.33 17.96a19.9 19.9 0 0 0 6.07 3.08c.49-.67.93-1.38 1.3-2.13a13 13 0 0 1-2.04-.98c.17-.13.34-.26.5-.4a14.2 14.2 0 0 0 12.1 0c.16.14.33.27.5.4-.65.39-1.34.72-2.05.99.38.74.81 1.45 1.3 2.12a19.8 19.8 0 0 0 6.08-3.08c.28-5.15-.47-9.62-3.77-13.59ZM8.02 15.25c-1.19 0-2.17-1.1-2.17-2.44 0-1.35.95-2.45 2.17-2.45s2.19 1.1 2.17 2.45c0 1.34-.96 2.44-2.17 2.44Zm7.96 0c-1.19 0-2.17-1.1-2.17-2.44 0-1.35.95-2.45 2.17-2.45s2.19 1.1 2.17 2.45c0 1.34-.95 2.44-2.17 2.44Z" />
    </svg>
  );
}

function Mark({ provider }: { provider: AuthProvider }) {
  if (provider === 'google') return <GoogleMark />;
  if (provider === 'discord') return <DiscordMark />;
  return (
    <span style={{ color: '#2AABEE', display: 'inline-flex' }}>
      <TelegramIcon size={16} />
    </span>
  );
}

export function useAuthProviders(): AuthProvider[] {
  // Backed by the shared ConfigProvider — no per-caller /config fetch.
  return useConfig()?.auth_providers ?? [];
}

export function ProviderSection({ mode }: { mode: 'login' | 'link' }) {
  const providers = useAuthProviders();
  if (providers.length === 0) return null;
  return (
    <div className={styles.section}>
      <div className={styles.divider}>
        <span>{'или'}</span>
      </div>
      <ProviderAuth mode={mode} />
    </div>
  );
}

type TelegramStart = {
  code: string;
  poll_secret: string;
  deep_link: string;
  bot: string;
  expires_in: number;
};

export default function ProviderAuth({
  mode,
  onLinked,
  hide = [],
}: {
  mode: 'login' | 'link';
  onLinked?: (identities: Identity[]) => void;
  hide?: AuthProvider[];
}) {
  const providers = useAuthProviders().filter((p) => !hide.includes(p));
  const { adoptSession } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [busy, setBusy] = useState<AuthProvider | null>(null);
  const [tg, setTg] = useState<TelegramStart | null>(null);
  const pollRef = useRef<number | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current !== null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => stopPolling, [stopPolling]);

  async function startOAuth(provider: AuthProvider) {
    setBusy(provider);
    try {
      const res = await api<{ url: string }>(
        `/auth/oauth/${provider}/url?mode=${mode}`
      );
      sessionStorage.setItem(OAUTH_MODE_KEY, mode);
      window.location.href = res.url;
    } catch (e) {
      toast(errMsg(e), 'error');
      setBusy(null);
    }
  }

  async function startTelegram() {
    setBusy('telegram');
    try {
      const res = await api<TelegramStart>('/auth/telegram/start', {
        method: 'POST',
        body: { mode },
      });
      setTg(res);
      window.open(res.deep_link, '_blank', 'noopener,noreferrer');

      const started = Date.now();
      pollRef.current = window.setInterval(async () => {
        if (Date.now() - started > res.expires_in * 1000) {
          stopPolling();
          setTg(null);
          setBusy(null);
          toast('Время ожидания истекло. Попробуйте ещё раз.', 'error');
          return;
        }
        try {
          const poll = await api<{
            status: 'pending' | 'ready';
            token?: string;
            user?: Me;
            identities?: Identity[];
          }>(
            `/auth/telegram/poll?code=${encodeURIComponent(res.code)}&secret=${encodeURIComponent(
              res.poll_secret
            )}`
          );
          if (poll.status !== 'ready') return;

          stopPolling();
          setTg(null);
          setBusy(null);
          if (poll.token && poll.user) {
            adoptSession(poll.user);
            if (poll.user.needs_setup) router.push('/auth/setup');
          } else if (poll.identities) {
            onLinked?.(poll.identities);
            toast('Telegram привязан', 'ok');
          }
        } catch (e) {
          stopPolling();
          setTg(null);
          setBusy(null);
          toast(errMsg(e), 'error');
        }
      }, 2000);
    } catch (e) {
      toast(errMsg(e), 'error');
      setBusy(null);
    }
  }

  if (providers.length === 0) return null;

  return (
    <>
      <div className={`${styles.grid} ${mode !== 'link' ? styles.auth : ''}`}>
        {providers.map((p) => (
          <button
            key={p}
            type="button"
            className={`${styles.btn} ${mode !== 'link' ? styles.auth : ''}`}
            disabled={busy !== null}
            onClick={() => (p === 'telegram' ? void startTelegram() : void startOAuth(p))}
          >
            {busy === p ? <Spinner size={14} inline /> : <Mark provider={p} />}
            {mode === 'link' && (
                <span>
                  Привязать {LABELS[p]}
                </span>
            )}

          </button>
        ))}
      </div>

      {tg ? (
        <div className={styles.tgPanel} role="status">
          <button
            type="button"
            className={styles.tgClose}
            aria-label={'Отменить'}
            onClick={() => {
              stopPolling();
              setTg(null);
              setBusy(null);
            }}
          >
            <X size={14} />
          </button>
          <p className={styles.tgTitle}>{'Ожидаем подтверждения в Telegram'}</p>
          <p className={styles.tgText}>
            {'Откройте чат с ботом @'}
            {tg.bot}
            {' и нажмите «Начать». Эта страница продолжит сама.'}
          </p>
          <a
            href={tg.deep_link}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.tgLink}
          >
            <ExternalLink size={13} />
            {'Открыть Telegram ещё раз'}
          </a>
        </div>
      ) : null}
    </>
  );
}
