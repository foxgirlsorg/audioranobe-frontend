'use client';

import React, { createContext, useCallback, useContext, useState } from 'react';

const COOKIE_NAME = 'mod_sidebar_collapsed';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

interface ModCollapseValue {
  collapsed: boolean;
  setCollapsed: (value: boolean | ((prev: boolean) => boolean)) => void;
}

const Ctx = createContext<ModCollapseValue | null>(null);

/**
 * Whether the desktop sidebar is collapsed to icons — scoped to the /mod
 * route group and seeded from a cookie read server-side in mod/layout.tsx,
 * so the first paint already matches the saved state (no flash) and the
 * choice survives navigating between mod pages (the layout, and this
 * provider, aren't remounted on those transitions).
 */
export function ModCollapseProvider({
  initialCollapsed,
  children,
}: {
  initialCollapsed: boolean;
  children: React.ReactNode;
}): JSX.Element {
  const [collapsed, setCollapsedState] = useState(initialCollapsed);

  const setCollapsed = useCallback((value: boolean | ((prev: boolean) => boolean)) => {
    setCollapsedState((prev) => {
      const next = typeof value === 'function' ? (value as (p: boolean) => boolean)(prev) : value;
      document.cookie = `${COOKIE_NAME}=${next ? '1' : '0'}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
      return next;
    });
  }, []);

  return <Ctx.Provider value={{ collapsed, setCollapsed }}>{children}</Ctx.Provider>;
}

export function useModCollapse(): ModCollapseValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useModCollapse must be used inside <ModCollapseProvider>');
  return ctx;
}

export { COOKIE_NAME as MOD_SIDEBAR_COOKIE };
