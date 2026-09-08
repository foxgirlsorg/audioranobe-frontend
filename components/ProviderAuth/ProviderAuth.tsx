'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { errMsg, useToast } from '@/lib/toast';
import { useEnsureConfig } from '@/lib/config';
import type { ProviderInfo } from '@/lib/types';
import Spinner from '@/components/Spinner/Spinner';
import styles from './ProviderAuth.module.css';

export const OAUTH_MODE_KEY = 'auralib.oauth.mode';

/**
 * The configured providers. Reading this triggers the one-time /config load, so
 * the provider list is only fetched when this row actually renders (i.e. when
 * the login/signup modal opens). Pass active=false to skip the fetch — used
 * when the caller already has the provider list (e.g. settings, from /me).
 */
export function useAuthProviders(active: boolean = true): ProviderInfo[] {
  return useEnsureConfig(active)?.auth_providers ?? [];
}

function ProviderIcon({ svg }: { svg: string }) {
  return <span className={styles.icon} aria-hidden="true" dangerouslySetInnerHTML={{ __html: svg }} />;
}

export function ProviderSection({ mode, providers }: { mode: 'login' | 'link'; providers?: ProviderInfo[] }) {
  const fetched = useAuthProviders(providers === undefined);
  const resolved = providers ?? fetched;
  if (resolved.length === 0) return null;
  return (
    <div className={styles.section}>
      <div className={styles.divider}>
        <span>{'или'}</span>
      </div>
      <ProviderAuth mode={mode} providers={resolved} />
    </div>
  );
}

export default function ProviderAuth({
  mode,
  hide = [],
  providers: providersProp,
}: {
  mode: 'login' | 'link';
  hide?: string[];
  providers?: ProviderInfo[];
}) {
  // When the caller supplies the list (settings, from /me) don't fetch /config.
  const fetched = useAuthProviders(providersProp === undefined);
  const providers = (providersProp ?? fetched).filter((p) => !hide.includes(p.id));
  const { toast } = useToast();

  const [busy, setBusy] = useState<string | null>(null);

  // Every provider — Telegram included — is a redirect-based OAuth/OIDC flow:
  // fetch the authorize URL, remember the mode, and hand the browser over. The
  // provider returns to /auth/callback/{provider}, which finishes the exchange.
  async function startOAuth(id: string) {
    setBusy(id);
    try {
      const res = await api<{ url: string }>(`/auth/oauth/${id}/url?mode=${mode}`);
      sessionStorage.setItem(OAUTH_MODE_KEY, mode);
      window.location.href = res.url;
    } catch (e) {
      toast(errMsg(e), 'error');
      setBusy(null);
    }
  }

  if (providers.length === 0) return null;

  return (
    <div className={`${styles.grid} ${mode !== 'link' ? styles.auth : ''}`}>
      {providers.map((p) => (
        <button
          key={p.id}
          type="button"
          className={`${styles.btn} ${mode !== 'link' ? styles.auth : ''}`}
          disabled={busy !== null}
          onClick={() => void startOAuth(p.id)}
          aria-label={mode === 'link' ? `Привязать ${p.name}` : `Войти через ${p.name}`}
        >
          {busy === p.id ? <Spinner size={14} inline /> : <ProviderIcon svg={p.icon_svg} />}
          {mode === 'link' && <span aria-hidden="true">Привязать {p.name}</span>}
        </button>
      ))}
    </div>
  );
}
