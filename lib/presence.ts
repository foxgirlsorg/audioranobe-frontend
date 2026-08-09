'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

/**
 * Client-side online presence.
 *
 * A single module-level manager tracks whether the viewer is "away" — the tab
 * is hidden, or there has been no input for IDLE_MS — and heartbeats the server
 * every PING_MS with the current state. Components subscribe via useAway() to
 * render the viewer's own dot and to slow their polling while away.
 */

export const PING_MS = 30_000;
const IDLE_MS = 60_000;
/** Multiplier applied to background polls (messages, notifications) while away. */
const AWAY_POLL_FACTOR = 4;

let away = false;
let started = false;
let idleTimer: number | null = null;
let pingTimer: number | null = null;
const listeners = new Set<(away: boolean) => void>();

export function isAway(): boolean {
  return away;
}

/** Base interval scaled up when the viewer is away, so idle tabs poll less. */
export function scalePoll(baseMs: number, isAwayNow: boolean): number {
  return isAwayNow ? baseMs * AWAY_POLL_FACTOR : baseMs;
}

function notify(): void {
  for (const fn of listeners) fn(away);
}

function ping(): void {
  api('/me/presence', { method: 'POST', body: { status: away ? 'away' : 'online' } }).catch(() => {});
}

function setAway(next: boolean): void {
  if (next === away) return;
  away = next;
  notify();
  // Flip promptly rather than waiting for the next scheduled heartbeat.
  ping();
}

function recompute(): void {
  setAway(document.hidden || idleTimer === null);
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

/**
 * Begin heartbeating. Called once the viewer is known to be signed in; safe to
 * call repeatedly (no-ops after the first). Returns a stop function.
 */
export function startPresence(): () => void {
  if (started) return stopPresence;
  started = true;

  const onActivity = () => markActive();
  const onVisibility = () => recompute();

  for (const ev of ACTIVITY_EVENTS) {
    window.addEventListener(ev, onActivity, { passive: true });
  }
  document.addEventListener('visibilitychange', onVisibility);

  markActive();
  ping();
  pingTimer = window.setInterval(ping, PING_MS);

  const stop = () => {
    for (const ev of ACTIVITY_EVENTS) window.removeEventListener(ev, onActivity);
    document.removeEventListener('visibilitychange', onVisibility);
    if (pingTimer !== null) window.clearInterval(pingTimer);
    if (idleTimer !== null) window.clearTimeout(idleTimer);
    pingTimer = null;
    idleTimer = null;
    started = false;
  };
  cleanup = stop;
  return stop;
}

let cleanup: (() => void) | null = null;
export function stopPresence(): void {
  cleanup?.();
  cleanup = null;
}

/** Subscribe to the viewer's own away state. */
export function useAway(): boolean {
  const [value, setValue] = useState(away);
  useEffect(() => {
    setValue(away);
    listeners.add(setValue);
    return () => {
      listeners.delete(setValue);
    };
  }, []);
  return value;
}
