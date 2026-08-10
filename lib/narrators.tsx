'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { NarratorCard } from '@/lib/types';

interface MyNarratorsValue {
  narrators: NarratorCard[];
  loaded: boolean;
  /** Fetch the list once, lazily — call it when something actually needs it. */
  ensureLoaded: () => void;
}

const Ctx = createContext<MyNarratorsValue | null>(null);

/**
 * The signed-in user's narrator teams, fetched lazily and shared. It never
 * changes during a session and isn't needed on most page loads, so there's no
 * reason to fetch it at startup — the navbar dropdown and the add-content dialog
 * call ensureLoaded() when opened, and share the single cached result.
 */
export function MyNarratorsProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const { user } = useAuth();
  const [narrators, setNarrators] = useState<NarratorCard[]>([]);
  const [loaded, setLoaded] = useState(false);
  const loadingRef = useRef(false);

  // Drop the cache when the signed-in user changes (login/logout/switch).
  useEffect(() => {
    setNarrators([]);
    setLoaded(false);
    loadingRef.current = false;
  }, [user?.id]);

  const ensureLoaded = useCallback(() => {
    if (!user || loaded || loadingRef.current) return;
    loadingRef.current = true;
    api<NarratorCard[]>('/panel/narrators')
      .then((list) => {
        setNarrators(Array.isArray(list) ? list : []);
        setLoaded(true);
      })
      .catch(() => {})
      .finally(() => {
        loadingRef.current = false;
      });
  }, [user, loaded]);

  return <Ctx.Provider value={{ narrators, loaded, ensureLoaded }}>{children}</Ctx.Provider>;
}

export function useMyNarrators(): MyNarratorsValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useMyNarrators must be used inside <MyNarratorsProvider>');
  return ctx;
}
