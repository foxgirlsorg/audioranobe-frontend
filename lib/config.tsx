'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { AuthProvider } from '@/lib/types';

export interface AppConfig {
  email_verification: boolean;
  auth_providers: AuthProvider[];
}

const ConfigContext = createContext<AppConfig | null>(null);

/**
 * Fetches the static /config once and shares it, so the several components that
 * need it (the unverified-email banner, the settings page, every auth-provider
 * button row) don't each fire their own request. /config is itself CDN-cached;
 * this removes even the duplicate cache hits within a page.
 */
export function ConfigProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [config, setConfig] = useState<AppConfig | null>(null);

  useEffect(() => {
    let alive = true;
    api<{ email_verification?: boolean; auth_providers?: AuthProvider[] }>('/config')
      .then((c) => {
        if (alive) {
          setConfig({
            email_verification: !!c.email_verification,
            auth_providers: c.auth_providers ?? [],
          });
        }
      })
      .catch(() => {
        if (alive) setConfig({ email_verification: false, auth_providers: [] });
      });
    return () => {
      alive = false;
    };
  }, []);

  return <ConfigContext.Provider value={config}>{children}</ConfigContext.Provider>;
}

/** The app config, or null until the single /config fetch resolves. */
export function useConfig(): AppConfig | null {
  return useContext(ConfigContext);
}
