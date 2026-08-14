'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Keeps a popup/overlay mounted for `duration` ms after `open` goes false, so
 * its CSS exit animation gets a chance to play instead of the element just
 * vanishing. Render while the returned value is true, and drive the
 * enter/exit animation class off the live `open` value itself.
 */
export function useAnimatedPresence(open: boolean, duration = 160): boolean {
  const [mounted, setMounted] = useState(open);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    if (open) {
      setMounted(true);
      return;
    }
    timer.current = window.setTimeout(() => setMounted(false), duration);
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, [open, duration]);

  return mounted;
}
