'use client';

import { useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { isStandalone } from '@/lib/pwa';
import { enablePush, pushPermission } from '@/lib/push';

/**
 * App-shell PWA side effects: register the service worker (needed for
 * installability and push), and — when the app is launched as an installed
 * PWA by a logged-in user who hasn't decided yet — request notification
 * permission and subscribe right away. Silent: an unconfigured push backend
 * or a declined prompt just no-ops.
 */
export default function PwaInit() {
  const { user } = useAuth();

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
    document.body.classList.toggle('pwa', isStandalone());
  }, []);

  useEffect(() => {
    if (!user || !isStandalone() || pushPermission() !== 'default') return;
    enablePush().catch(() => {});
  }, [user]);

  return null;
}
