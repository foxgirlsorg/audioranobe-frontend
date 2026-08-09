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
import type { Me } from '@/lib/types';

interface AuthContextValue {
  user: Me | null;
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
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [user, setUser] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // The session lives in an HttpOnly cookie JS can't read. Rather than probe
    // /me on boot, we listen for the X-Me header the backend attaches to every
    // response and pick up auth state from the page's own data requests (the
    // home page's /home, a title's /titles/:slug, etc.).
    onViewer((me) => {
      setUser((me as Me | null) ?? null);
      setLoading(false);
    });
    return () => {
      onViewer(null);
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

  const isMod = !!user && (user.role === 'moderator' || user.role === 'admin');

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, login, register, adoptSession, logout, refresh, isMod }),
    [user, loading, login, register, adoptSession, logout, refresh, isMod]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
