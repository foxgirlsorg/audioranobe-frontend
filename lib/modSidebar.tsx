'use client';

import React, { createContext, useContext, useState } from 'react';

interface ModSidebarValue {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const Ctx = createContext<ModSidebarValue | null>(null);

/**
 * Open state for the moderation section's mobile nav drawer. The toggle
 * button lives in the global NavBar (next to the avatar); the drawer itself
 * is rendered by ModNav, deep inside <main> — a context is the simplest way
 * to connect the two without prop drilling through the root layout.
 */
export function ModSidebarProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [open, setOpen] = useState(false);
  return <Ctx.Provider value={{ open, setOpen }}>{children}</Ctx.Provider>;
}

export function useModSidebar(): ModSidebarValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useModSidebar must be used inside <ModSidebarProvider>');
  return ctx;
}
