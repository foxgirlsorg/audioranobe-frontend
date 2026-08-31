'use client';

import { useEffect, useRef } from 'react';

/**
 * Makes the browser Back gesture dismiss an open overlay (full-screen player,
 * image viewer) instead of leaving the page. Opening pushes a throwaway history
 * entry; Back pops it and runs `close` while the URL stays put. Closing through
 * the UI pops that same entry so Back isn't swallowed afterwards.
 */
export function useBackToClose(open: boolean, close: () => void): void {
  const pushed = useRef(false);
  const closeRef = useRef(close);
  closeRef.current = close;

  useEffect(() => {
    if (open && !pushed.current) {
      pushed.current = true;
      window.history.pushState({ __overlay: true }, '');
    } else if (!open && pushed.current) {
      pushed.current = false;
      window.history.back();
    }
  }, [open]);

  useEffect(() => {
    const onPop = () => {
      if (pushed.current) {
        pushed.current = false;
        closeRef.current();
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
}
