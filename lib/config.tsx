'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import type { ProviderInfo } from '@/lib/types';

export interface AppConfig {
  email_verification: boolean;
  auth_providers: ProviderInfo[];
  captcha: { enabled: boolean; site_key: string; script_url: string; widget_var: string };
}

interface ConfigCtx {
  config: AppConfig | null;
  ensure: () => void;
}

const ConfigContext = createContext<ConfigCtx | null>(null);

/**
 * Lazily fetches /config once and shares it. Nothing is requested on a plain
 * page load: the fetch only fires when a component that actually needs config
 * mounts and calls ensure() — the login/signup modal (auth providers) or the
 * unverified-email banner (only for a signed-in user). /config is CDN-cached, so
 * the single fetch is shared across every consumer for the rest of the session.
 */
export function ConfigProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const started = useRef(false);

  const ensure = useCallback(() => {
    if (started.current) return;
    started.current = true;
    api<{
      email_verification?: boolean;
      auth_providers?: ProviderInfo[];
      captcha?: { enabled?: boolean; site_key?: string; script_url?: string; widget_var?: string };
    }>('/config')
      .then((c) =>
        setConfig({
          email_verification: !!c.email_verification,
          auth_providers: c.auth_providers ?? [],
          captcha: {
            enabled: !!c.captcha?.enabled,
            site_key: c.captcha?.site_key ?? '',
            script_url: c.captcha?.script_url ?? '',
            widget_var: c.captcha?.widget_var ?? '',
          },
        })
      )
      .catch(() =>
        setConfig({
          email_verification: false,
          auth_providers: [],
          captcha: { enabled: false, site_key: '', script_url: '', widget_var: '' },
        })
      );
  }, []);

  return <ConfigContext.Provider value={{ config, ensure }}>{children}</ConfigContext.Provider>;
}

/** Read the config without triggering a fetch (null until something loads it). */
export function useConfig(): AppConfig | null {
  return useContext(ConfigContext)?.config ?? null;
}

/**
 * Read the config and trigger its one-time load. Pass active=false to read
 * without loading (e.g. the banner, which only needs config once a user exists).
 */
export function useEnsureConfig(active: boolean = true): AppConfig | null {
  const ctx = useContext(ConfigContext);
  useEffect(() => {
    if (active) ctx?.ensure();
  }, [active, ctx]);
  return ctx?.config ?? null;
}
