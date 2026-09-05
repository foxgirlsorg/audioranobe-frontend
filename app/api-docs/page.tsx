'use client';

import { useMemo, useState } from 'react';
import { Check, ChevronRight, Copy, Send } from 'lucide-react';
import JsonBlock from '@/components/JsonBlock/JsonBlock';
import { useResolveAuth } from '@/lib/useResolveAuth';
import { API_DOCS_GROUPS, type Param } from '@/lib/apiDocsGroups';
import styles from './page.module.css';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080/api';

// Starting values so an example runs on the first «Отправить». Path segments
// default to 1; a couple of required query keys get a sane seed. Everything is
// editable.
const QUERY_DEFAULTS: Record<string, string> = {
  target_type: 'title',
  target_id: '1',
};

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={styles.copy}
      aria-label={'Скопировать'}
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1200);
        });
      }}
    >
      {done ? <Check size={13} /> : <Copy size={13} />}
    </button>
  );
}

// Live request runner. One input per argument — the {…} path segments and each
// query parameter. The URL is assembled from them and sent WITHOUT credentials,
// so the response is always the anonymous view (account-specific fields like
// my_rating or my_position come back empty regardless of who is signed in).
function TryIt({ path, params }: { path: string; params?: Param[] }) {
  const pathKeys = useMemo(
    () => [...path.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]),
    [path]
  );
  const queryFields = useMemo(() => {
    const out: Param[] = [];
    for (const p of params ?? []) out.push({ name: p.name.trim(), desc: p.desc });
    return out;
  }, [params]);

  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const k of pathKeys) init[`path:${k}`] = '1';
    for (const f of queryFields) init[`q:${f.name}`] = QUERY_DEFAULTS[f.name] ?? '';
    return init;
  });
  const set = (k: string, v: string) => setValues((prev) => ({ ...prev, [k]: v }));

  const url = useMemo(() => {
    let p = path;
    for (const k of pathKeys) {
      p = p.replace(`{${k}}`, encodeURIComponent((values[`path:${k}`] ?? '').trim()));
    }
    const qs = new URLSearchParams();
    for (const f of queryFields) {
      const v = (values[`q:${f.name}`] ?? '').trim();
      if (v) qs.set(f.name, v);
    }
    const s = qs.toString();
    return `${API_BASE}${p}${s ? `?${s}` : ''}`;
  }, [path, pathKeys, queryFields, values]);

  const canSend = pathKeys.every((k) => (values[`path:${k}`] ?? '').trim() !== '');

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<number | null>(null);
  const [body, setBody] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const send = async () => {
    if (!canSend) return;
    setLoading(true);
    setStatus(null);
    setBody(null);
    setFailed(false);
    try {
      const res = await fetch(url, { credentials: 'omit' });
      setStatus(res.status);
      const text = await res.text();
      try {
        setBody(JSON.stringify(JSON.parse(text), null, 2));
      } catch {
        setBody(text);
      }
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };

  const onEnter = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') void send();
  };

  return (
    <div className={styles.tryBody}>
      {pathKeys.length > 0 || queryFields.length > 0 ? (
        <div className={styles.fields}>
          {pathKeys.map((k) => (
            <div key={`path:${k}`} className={styles.field}>
              <span className={styles.fieldName}>{`{${k}}`}</span>
              <input
                className={styles.fieldInput}
                value={values[`path:${k}`] ?? ''}
                spellCheck={false}
                autoComplete="off"
                onChange={(e) => set(`path:${k}`, e.target.value)}
                onKeyDown={onEnter}
              />
              <span className={styles.fieldDesc}>{'Часть адреса — slug или числовой id.'}</span>
            </div>
          ))}
          {queryFields.map((f) => (
            <div key={`q:${f.name}`} className={styles.field}>
              <span className={styles.fieldName}>{f.name}</span>
              <input
                className={styles.fieldInput}
                value={values[`q:${f.name}`] ?? ''}
                placeholder={'—'}
                spellCheck={false}
                autoComplete="off"
                onChange={(e) => set(`q:${f.name}`, e.target.value)}
                onKeyDown={onEnter}
              />
              <span className={styles.fieldDesc}>{f.desc}</span>
            </div>
          ))}
        </div>
      ) : null}

      <div className={styles.codeRow}>
        <code className={styles.code}>{url}</code>
        <CopyButton text={url} />
      </div>

      <div className={styles.tryRow}>
        <button
          type="button"
          className={styles.trySend}
          onClick={() => void send()}
          disabled={loading || !canSend}
        >
          <Send size={13} />
          {loading ? 'Отправка…' : 'Отправить'}
        </button>
        {status !== null ? (
          <span className={status < 400 ? styles.statusOk : styles.statusErr}>{`HTTP ${status}`}</span>
        ) : null}
        {failed ? <span className={styles.statusErr}>{'Не удалось выполнить запрос.'}</span> : null}
      </div>

      {body !== null ? <JsonBlock code={body} /> : null}
    </div>
  );
}

export default function ApiDocsPage() {
  useResolveAuth();
  return (
    <div className={styles.wrap}>
      <span className="eyebrow">{'Для разработчиков'}</span>
      <h1 className={styles.title}>
        {'документация'} <span className={styles.titleAccent}>{'API'}</span>
      </h1>

      <section className={`glass-panel ${styles.panel}`}>
        <h2 className={styles.panelTitle}>{'Базовый адрес'}</h2>
        <div className={styles.codeRow}>
          <code className={styles.code}>{API_BASE}</code>
          <CopyButton text={API_BASE} />
        </div>
        <p className={styles.note}>
          {'Ответы — JSON в UTF-8; ошибки приходят как {"error": "текст"} с соответствующим HTTP-статусом.'}
        </p>
        <p className={styles.note}>
          {'Все эндпоинты ниже — публичные GET: авторизация не нужна, вызвать их можно с любого домена. '}
          {'Запросы отсюда уходят без авторизации, поэтому поля, зависящие от аккаунта, приходят пустыми.'}
        </p>
      </section>

      {API_DOCS_GROUPS.map((group) => (
        <section key={group.title} className={styles.group}>
          <h2 className={styles.groupTitle}>{group.title}</h2>
          <div className={styles.endpoints}>
            {group.endpoints.map((ep) => (
              <article key={ep.path} className={`glass-panel ${styles.endpoint}`}>
                <div className={styles.epHead}>
                  <span className={styles.method}>{'GET'}</span>
                  <code className={styles.epPath}>{ep.path}</code>
                  <CopyButton text={API_BASE + ep.path} />
                </div>
                <p className={styles.epDesc}>{ep.desc}</p>
                {ep.note ? <p className={styles.epNote}>{ep.note}</p> : null}
                <details className={styles.sample}>
                  <summary className={styles.sampleToggle}>
                    <ChevronRight size={13} className={styles.sampleChev} />
                    {'Попробовать'}
                  </summary>
                  <TryIt path={ep.path} params={ep.params} />
                </details>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
