'use client';

import { useEffect, useRef } from 'react';

/**
 * Makes the browser Back gesture dismiss an open overlay (full-screen player,
 * image viewer) instead of leaving the page. Opening pushes a throwaway history
 * entry; Back pops it and runs `close` while the URL stays put. Closing through
 * the UI pops that same entry so Back isn't swallowed afterwards.
 *
 * Overlays stack: the image viewer can open on top of the full-screen player.
 * One Back pops one entry, so only the top-most open overlay closes, and the
 * popstate our own UI-close `history.back()` triggers is swallowed rather than
 * closing whatever sits underneath.
 */

interface Entry {
  popped: () => void;
}

const stack: Entry[] = [];
let selfPops = 0;
let listening = false;

function onPop() {
  if (selfPops > 0) {
    selfPops -= 1;
    return;
  }
  stack.pop()?.popped();
}

function remove(entry: Entry) {
  const i = stack.indexOf(entry);
  if (i >= 0) stack.splice(i, 1);
}

export function useBackToClose(open: boolean, close: () => void): void {
  const entry = useRef<Entry | null>(null);
  const closeRef = useRef(close);
  closeRef.current = close;

  useEffect(() => {
    if (!listening) {
      listening = true;
      window.addEventListener('popstate', onPop);
    }
    if (open && !entry.current) {
      const e: Entry = {
        popped: () => {
          entry.current = null;
          closeRef.current();
        },
      };
      entry.current = e;
      stack.push(e);
      window.history.pushState({ __overlay: true }, '');
    } else if (!open && entry.current) {
      remove(entry.current);
      entry.current = null;
      selfPops += 1;
      window.history.back();
    }
  }, [open]);

  useEffect(
    () => () => {
      if (entry.current) remove(entry.current);
    },
    []
  );
}
