'use client';

import { useEffect, useState } from 'react';

/**
 * Client-side activity state — no network. Presence on the server is passive
 * (any request marks you seen for 5 minutes), so this only drives (a) the
 * viewer's OWN status dot and (b) slowing background polls while idle/unfocused.
 *
 * "away" means the window is hidden, not the focused window (covers a second
 * monitor showing the site unfocused), or there has been no input for IDLE_MS.
 */

const IDLE_MS = 60_000;
/** Multiplier applied to background polls (chat/notifications) while away. */
const AWAY_POLL_FACTOR = 4;

let away = false;
let idleTimer: number | null = null;
let started = false;
let stop: (() => void) | null = null;
let subscribers = 0;
const listeners = new Set<(away: boolean) => void>();

/** Base interval scaled up when the viewer is away, so idle tabs poll less. */
export function scalePoll(baseMs: number, isAwayNow: boolean): number {
  return isAwayNow ? baseMs * AWAY_POLL_FACTOR : baseMs;
}

function focused(): boolean {
  try {
    return document.hasFocus();
  } catch {
    return true;
  }
}

function recompute(): void {
  const next = document.hidden || !focused() || idleTimer === null;
  if (next !== away) {
    away = next;
    for (const fn of listeners) fn(away);
  }
}

function markActive(): void {
  if (idleTimer !== null) window.clearTimeout(idleTimer);
  idleTimer = window.setTimeout(() => {
    idleTimer = null;
    recompute();
  }, IDLE_MS);
  recompute();
}

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'] as const;

function start(): void {
  if (started) return;
  started = true;

  const onActivity = () => markActive();
  const onVisibility = () => recompute();
  const onFocus = () => markActive();
  const onBlur = () => recompute();

  for (const ev of ACTIVITY_EVENTS) window.addEventListener(ev, onActivity, { passive: true });
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('focus', onFocus);
  window.addEventListener('blur', onBlur);
  markActive();

  stop = () => {
    for (const ev of ACTIVITY_EVENTS) window.removeEventListener(ev, onActivity);
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('focus', onFocus);
    window.removeEventListener('blur', onBlur);
    if (idleTimer !== null) window.clearTimeout(idleTimer);
    idleTimer = null;
    started = false;
  };
}

/** Subscribe to the viewer's own away state; starts tracking on first use. */
export function useAway(): boolean {
  const [value, setValue] = useState(away);
  useEffect(() => {
    subscribers += 1;
    if (subscribers === 1) start();
    setValue(away);
    listeners.add(setValue);
    return () => {
      listeners.delete(setValue);
      subscribers -= 1;
      if (subscribers === 0 && stop) {
        stop();
        stop = null;
      }
    };
  }, []);
  return value;
}
