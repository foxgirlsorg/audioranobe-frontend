'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { api, ApiError, getToken, setToken } from '@/lib/api';
import type { Me } from '@/lib/types';

interface AuthContextValue {
  user: Me | null;
  loading: boolean;
  login(login: string, password: string): Promise<void>;
  register(username: string, email: string, password: string, acceptTerms: boolean): Promise<void>;
  logout(): void;
  refresh(): Promise<void>;
  isMod: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [user, setUser] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (getToken()) {
        try {
          const me = await api<Me>('/me');
          if (alive) setUser(me);
        } catch (e) {
          if (e instanceof ApiError && e.status === 401) {
            setToken(null);
            if (alive) setUser(null);
          }
          // network / 5xx: stay logged out for this render but keep the token
        }
      }
      if (alive) setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      return;
    }
    try {
      const me = await api<Me>('/me');
      setUser(me);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setToken(null);
        setUser(null);
      }
    }
  }, []);

  const login = useCallback(async (login: string, password: string) => {
    const res = await api<{ token: string; user: Me }>('/auth/login', {
      method: 'POST',
      body: { login, password },
    });
    setToken(res.token);
    setUser(res.user);
  }, []);

  const register = useCallback(
    async (username: string, email: string, password: string, acceptTerms: boolean) => {
      const res = await api<{ token: string; user: Me }>('/auth/register', {
        method: 'POST',
        body: { username, email, password, accept_terms: acceptTerms },
      });
      setToken(res.token);
      setUser(res.user);
    },
    []
  );

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  const isMod = !!user && (user.role === 'moderator' || user.role === 'admin');

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, login, register, logout, refresh, isMod }),
    [user, loading, login, register, logout, refresh, isMod]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
