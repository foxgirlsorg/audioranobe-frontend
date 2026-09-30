'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Copy, RefreshCw } from 'lucide-react';

/** Route error boundary: shows the actual client error so it can be reported without devtools. */
export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [copied, setCopied] = useState(false);
  const details = [
    `${error.name}: ${error.message}`,
    error.digest ? `digest: ${error.digest}` : '',
    typeof window !== 'undefined' ? `url: ${window.location.pathname}${window.location.search}` : '',
    (error.stack ?? '').split('\n').slice(1, 8).join('\n'),
  ].filter(Boolean).join('\n');

  useEffect(() => {
    console.error(error);
  }, [error]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(details);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="glass-panel" style={{ maxWidth: 640, margin: '48px auto', padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <AlertTriangle size={18} color="var(--accent)" />
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 500 }}>{'Что-то пошло не так'}</h1>
      </div>
      <p style={{ margin: '0 0 6px', color: 'var(--text)', fontSize: 14, wordBreak: 'break-word' }}>
        {error.message || error.name || 'Неизвестная ошибка'}
      </p>
      <p style={{ margin: '0 0 12px', color: 'var(--text-secondary)', fontSize: 13 }}>
        {'Если повторится — скопируйте подробности ниже и пришлите их нам.'}
      </p>
      <pre
        style={{
          margin: '0 0 14px',
          padding: 12,
          maxHeight: 240,
          overflow: 'auto',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          fontSize: 12,
          color: 'var(--text-muted)',
          background: 'rgba(0, 0, 0, 0.3)',
          borderRadius: 8,
        }}
      >
        {details}
      </pre>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="btn" onClick={reset}>
          <RefreshCw size={14} /> {'Повторить'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => void copy()}>
          <Copy size={14} /> {copied ? 'Скопировано' : 'Скопировать'}
        </button>
      </div>
    </div>
  );
}
