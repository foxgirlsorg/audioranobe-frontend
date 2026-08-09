'use client';

import { useEffect } from 'react';
import { useAuth } from '@/lib/auth';

/**
 * For routes that fire no auth-resolving request on mount — fully static
 * content (/api-docs) or the auth forms that only hit the API on submit. With no
 * ordinary response for the backend's X-Me header to ride on, the session would
 * never settle and the shared NavBar would sit in its loading state. Ask /me
 * once on mount to resolve it. On pages that already fetch data this hook isn't
 * needed (their X-Me does the job) and must not be added — it would double up.
 */
export function useResolveAuth(): void {
  const { loading, refresh } = useAuth();
  useEffect(() => {
    if (loading) void refresh();
    // Mount-only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
