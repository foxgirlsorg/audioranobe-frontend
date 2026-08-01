'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { api } from '@/lib/api';
import { errMsg } from '@/lib/toast';
import Spinner from '@/components/Spinner/Spinner';
import EmptyState from '@/components/EmptyState/EmptyState';
import Markdown from '@/components/Markdown/Markdown';
import styles from '../legal.module.css';

function headingId(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
}

export default function RulesPage() {
  const [body, setBody] = useState('');
  const [error, setError] = useState('');

  const sections = useMemo(
    () =>
      body
        .split('\n')
        .filter((l) => l.startsWith('## '))
        .map((l) => {
          const text = l.slice(3).trim();
          return { id: headingId(text), text };
        }),
    [body]
  );

  useEffect(() => {
    let alive = true;
    api<{ type: string; title: string; body: string }>('/legal/rules')
      .then((d) => {
        if (alive) setBody(d.body);
      })
      .catch((e) => {
        if (alive) setError(errMsg(e));
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className={styles.wrap}>
      <Link href="/legal" className="back-link">
        <ArrowLeft size={14} />
        {'Правовая информация'}
      </Link>

      <h1 className={styles.title}>
        {'Правила'} <span className={styles.titleAccent}>{'сервиса'}</span>
      </h1>

      {error ? (
        <EmptyState title="Не удалось загрузить правила" body={error} />
      ) : !body ? (
        <div className={styles.center}>
          <Spinner />
        </div>
      ) : (
        <>
          {sections.length > 0 ? (
            <nav className={styles.toc} aria-label="Разделы правил">
              {sections.map((s) => (
                <a key={s.id} href={`#${s.id}`} className={styles.tocLink}>
                  {s.text}
                </a>
              ))}
            </nav>
          ) : null}

          <div className={styles.section}>
            <Markdown source={body} />
          </div>
        </>
      )}
    </div>
  );
}
