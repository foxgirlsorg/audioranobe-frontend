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
    root.innerHTML = `<style>:host{display:block;width:min(380px,100%);}${css}</style>${html}`;
  }, [html, css]);

  return <div ref={hostRef} />;
}
