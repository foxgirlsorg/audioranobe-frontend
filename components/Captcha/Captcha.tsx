'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useEnsureConfig } from '@/lib/config';
import styles from './Captcha.module.css';

interface WidgetApi {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  remove?: (id: string) => void;
  reset?: (id: string) => void;
}

const scriptPromises: Record<string, Promise<void>> = {};

function loadScript(src: string): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject();
  if (!scriptPromises[src]) {
    scriptPromises[src] = new Promise<void>((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => {
        delete scriptPromises[src];
        reject(new Error('captcha script load failed'));
      };
      document.head.appendChild(s);
    });
  }
  return scriptPromises[src];
}

/**
 * Provider-agnostic captcha widget. Loads the admin-configured script and drives
 * whatever global it exposes (window[widget_var]) through the reCAPTCHA-style
 * explicit-render API that Turnstile, reCAPTCHA v2 and hCaptcha all share.
 * Renders nothing when captcha is off. Reports the solved token (and '' on
 * expiry/error) via onToken.
 */
export default function Captcha({ onToken }: { onToken: (token: string) => void }): JSX.Element | null {
  const config = useEnsureConfig();
  const ref = useRef<HTMLDivElement | null>(null);
  const widgetId = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;
  const [loaded, setLoaded] = useState(false);

  const c = config?.captcha;
  const active = !!c?.enabled && !!c.site_key && !!c.script_url && !!c.widget_var;
  const siteKey = active ? c!.site_key : '';
  const scriptUrl = active ? c!.script_url : '';
  const widgetVar = active ? c!.widget_var : '';

  useEffect(() => {
    if (!active || !ref.current) return;
    const el = ref.current;
    let cancelled = false;
    setLoaded(false);
    loadScript(scriptUrl)
      .then(() => {
        if (cancelled) return;
        const api = (window as unknown as Record<string, WidgetApi | undefined>)[widgetVar];
        if (!api || typeof api.render !== 'function') return;
        widgetId.current = api.render(el, {
          sitekey: siteKey,
          theme: 'dark',
          callback: (t: string) => onTokenRef.current(t),
          'expired-callback': () => onTokenRef.current(''),
          'error-callback': () => onTokenRef.current(''),
        });
        setLoaded(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      const api = (window as unknown as Record<string, WidgetApi | undefined>)[widgetVar];
      if (widgetId.current && api) {
        try {
          (api.remove ?? api.reset)?.(widgetId.current);
        } catch {
        }
        widgetId.current = null;
      }
    };
  }, [active, siteKey, scriptUrl, widgetVar]);

  if (!active) return null;
  return (
    <div className={styles.wrap}>
      {!loaded ? <span className={styles.loadingText}>Загружаем проверку…</span> : null}
      <div ref={ref} />
    </div>
  );
}
