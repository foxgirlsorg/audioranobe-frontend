'use client';

import { useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { startPresence, stopPresence } from '@/lib/presence';

/**
 * Runs the presence heartbeat for the whole app. Lives in the layout so it
 * pings regardless of which page is open; starts only once a viewer is signed
 * in and stops on sign-out. Renders nothing.
 */
export default function PresencePinger() {
  const { user } = useAuth();
  useEffect(() => {
    if (!user) return;
    const stop = startPresence();
    return () => {
      stop();
      stopPresence();
    };
  }, [user]);
  return null;
}
