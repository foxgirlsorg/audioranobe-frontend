'use client';

import React, { useEffect, useRef } from 'react';

/**
 * Renders an admin-authored yearly recap card (already token-filled HTML plus
 * CSS) inside an isolated shadow root, so its styles neither leak into the app
 * nor inherit from it. Content is admin-trusted.
 */
export default function RecapCard({ html, css }: { html: string; css: string }) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const root = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
    // A definite width (not a percentage) avoids the classic circular-sizing
    // trap: this host sits in a shrink-to-fit flex wrapper, so a `%` width
    // here would need the wrapper's size to already be known while the
    // wrapper's own shrink-to-fit size depends on this host — CSS leaves that
    // undefined, and browsers resolved it by cropping the card's right/bottom
    // edge. `max-width` alone is a post-hoc clamp, not a circular input, so it
    // stays safe.
    root.innerHTML = `<style>:host{display:block;width:380px;max-width:100%;}${css}</style>${html}`;
  }, [html, css]);

  return <div ref={hostRef} />;
}
