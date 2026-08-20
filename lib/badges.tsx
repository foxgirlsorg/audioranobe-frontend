'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { usePathname } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { FRIENDS_CHANGED } from '@/lib/friends';

const POLL_MS = 30_000;

export interface Badges {
  messages: number;
  notifications: number;
  friend_requests: number;
}

interface BadgesValue extends Badges {
  /** Force an immediate re-fetch (e.g. after marking things read). */
  refresh: () => void;
  /** Optimistically adjust counts so the UI reacts before the next poll. */
  patch: (p: Partial<Badges> | ((b: Badges) => Partial<Badges>)) => void;
}

const ZERO: Badges = { messages: 0, notifications: 0, friend_requests: 0 };
const BadgesContext = createContext<BadgesValue | null>(null);

/**
 * One poll for every navbar badge (messages, notifications, friend requests),
 * via a single GET /me/summary shared through context. Skips entirely while
 * the tab is hidden and catches up on visibility, navigation, and
 * friend-graph changes.
 */
export function BadgesProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const { user } = useAuth();
  const pathname = usePathname();
  const [badges, setBadges] = useState<Badges>(ZERO);

  const refresh = useCallback(() => {
    if (!user || (typeof document !== 'undefined' && document.hidden)) return;
    api<Badges>('/me/summary')
      .then(setBadges)
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    if (!user) {
      setBadges(ZERO);
      return;
    }
    refresh();
    const iv = window.setInterval(refresh, POLL_MS);
    const onVisible = () => {
      if (!document.hidden) refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener(FRIENDS_CHANGED, refresh);
    return () => {
      window.clearInterval(iv);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener(FRIENDS_CHANGED, refresh);
    };
    // pathname: opening chat/notifications should clear its badge promptly.
  }, [user, refresh, pathname]);

  const patch = useCallback(
    (p: Partial<Badges> | ((b: Badges) => Partial<Badges>)) =>
      setBadges((b) => ({ ...b, ...(typeof p === 'function' ? p(b) : p) })),
    []
  );

  const value = useMemo<BadgesValue>(
    () => ({ ...badges, refresh, patch }),
    [badges, refresh, patch]
  );

  return <BadgesContext.Provider value={value}>{children}</BadgesContext.Provider>;
}

export function useBadges(): BadgesValue {
  const ctx = useContext(BadgesContext);
  if (!ctx) throw new Error('useBadges must be used inside <BadgesProvider>');
  return ctx;
}
