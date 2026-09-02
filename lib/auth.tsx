'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { api, ApiError, onViewer } from '@/lib/api';
import type { Me, Viewer } from '@/lib/types';

interface AuthContextValue {
  // Slim Viewer: it comes from the X-Me header on every response. The heavy
  // profile fields (bio, socials, prefs, identities) live on Me — fetch GET /me
  // where they're needed (the settings page).
  user: Viewer | null;
  loading: boolean;
  login(login: string, password: string): Promise<void>;
  register(
    username: string,
    email: string,
    password: string,
    acceptTerms: boolean,
    displayName?: string
  ): Promise<void>;
  adoptSession(user: Me): void;
  logout(): void;
  refresh(): Promise<void>;
  isMod: boolean;
  /** True when the viewer's role grants the permission (or holds '*'). */
  can(perm: string): boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [user, setUser] = useState<Viewer | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Primary path: every credentialed API response ships an X-Me header.
    // This listener fires and resolves loading without an extra round-trip.
    const unsubscribe = onViewer((me) => {
      setUser((me as Viewer | null) ?? null);
      setLoading(false);
    });

    // Fallback: on SSR pages (title pages, narrator pages, …) the client
    // component skips its initial fetch because the server already returned
    // data.  ConfigProvider's /config call uses publicCache which suppresses
    // X-Me.  BadgesProvider won't poll until user is set.  Nothing else fires
    // on mount — so the primary listener never gets called and loading stays
    // true forever, hiding the NavBar and freezing /edit pages.
    //
    // setTimeout(0) runs after all synchronous effects in this render cycle.
    // If an API call returns X-Me in the meantime (normal SPA navigation), the
    // listener above already set loading = false; the /me call below is a
    // harmless no-op since setLoading / setUser are idempotent.
    const t = window.setTimeout(async () => {
      try {
        const me = await api<Me>('/me');
        setUser((me as Viewer | null) ?? null);
      } catch {
        // 401 = not logged in; network error = treat as logged out.
        setUser(null);
      } finally {
        setLoading(false);
      }
    }, 0);

    return () => {
      unsubscribe();
      window.clearTimeout(t);
    };
  }, []);

  const refresh = useCallback(async () => {
    try {
      const me = await api<Me>('/me');
      setUser(me);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setUser(null);
      }
    }
  }, []);

  const login = useCallback(async (login: string, password: string) => {
    // The server sets the auth cookie on this response; we just take the user.
    const res = await api<{ token: string; user: Me }>('/auth/login', {
      method: 'POST',
      body: { login, password },
    });
    setUser(res.user);
  }, []);

  const register = useCallback(
    async (
      username: string,
      email: string,
      password: string,
      acceptTerms: boolean,
      displayName = ''
    ) => {
      const res = await api<{ token: string; user: Me }>('/auth/register', {
        method: 'POST',
        body: {
          username,
          email,
          password,
          accept_terms: acceptTerms,
          ...(displayName ? { display_name: displayName } : {}),
        },
      });
      setUser(res.user);
    },
    []
  );

  // OAuth/Telegram sign-in: the callback response already set the auth cookie,
  // so adopting a session is just taking the returned user.
  const adoptSession = useCallback((me: Me) => {
    setUser(me);
  }, []);

  const logout = useCallback(() => {
    // Only the server can clear an HttpOnly cookie; drop our view immediately.
    setUser(null);
    api('/auth/logout', { method: 'POST' }).catch(() => {});
  }, []);

  const permissions = user?.permissions ?? [];
  const can = useCallback(
    (perm: string) => permissions.includes('*') || permissions.includes(perm),
    [permissions]
  );
  const isMod = can('mod.panel');

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, login, register, adoptSession, logout, refresh, isMod, can }),
    [user, loading, login, register, adoptSession, logout, refresh, isMod, can]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
