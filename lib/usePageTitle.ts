'use client';

import { useEffect } from 'react';

export const SITE_NAME = 'AudioRanobe';

export function usePageTitle(name: string | null | undefined): void {
  useEffect(() => {
    document.title = name ? `${name} — ${SITE_NAME}` : SITE_NAME;
  }, [name]);
}
