'use client';

import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    window.dispatchEvent(new Event('pwa:installable'));
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    window.dispatchEvent(new Event('pwa:installed'));
  });
}

/**
 * Dev/preview override: `?pwa` forces standalone view (persisted in
 * localStorage so it survives navigation); `?pwa=0` clears it.
 */
function pwaOverride(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const p = new URLSearchParams(window.location.search);
    if (p.has('pwa')) {
      const v = p.get('pwa');
      if (v === '0' || v === 'false') localStorage.removeItem('pwa-force');
      else localStorage.setItem('pwa-force', '1');
    }
    return localStorage.getItem('pwa-force') === '1';
  } catch {
    return false;
  }
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    pwaOverride() ||
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferredPrompt) return 'unavailable';
  await deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  if (outcome === 'accepted') deferredPrompt = null;
  return outcome;
}

/**
 * Install affordance state. `standalone` is true when already running as an
 * installed app (button should hide). `canInstall` is true once the browser
 * has offered a native install prompt (Chrome/Android/desktop); iOS never
 * fires it, so `ios` gates the manual "Add to Home Screen" instructions.
 */
export function useInstall(): {
  canInstall: boolean;
  standalone: boolean;
  ios: boolean;
} {
  const [canInstall, setCanInstall] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    setStandalone(isStandalone());
    setIos(isIOS());
    setCanInstall(deferredPrompt !== null);
    const onInstallable = () => setCanInstall(true);
    const onInstalled = () => {
      setCanInstall(false);
      setStandalone(true);
    };
    window.addEventListener('pwa:installable', onInstallable);
    window.addEventListener('pwa:installed', onInstalled);
    return () => {
      window.removeEventListener('pwa:installable', onInstallable);
      window.removeEventListener('pwa:installed', onInstalled);
    };
  }, []);

  return { canInstall, standalone, ios };
}
