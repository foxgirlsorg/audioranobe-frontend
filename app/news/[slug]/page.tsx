'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Megaphone } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { errMsg } from '@/lib/toast';
import { formatDate } from '@/lib/format';
import type { Announcement } from '@/lib/types';
import Spinner from '@/components/Spinner';
import EmptyState from '@/components/EmptyState';
import Markdown from '@/components/Markdown';
import CommentSection from '@/components/CommentSection';
import styles from './page.module.css';

export default function NewsItemPage({ params }: { params: { slug: string } }) {
  const slug = decodeURIComponent(params.slug);

  const [item, setItem] = useState<Announcement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [missing, setMissing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItem(await api<Announcement>(`/announcements/${encodeURIComponent(slug)}`));
      setError('');
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) setMissing(true);
      else setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (item) document.title = `${item.title} — AudioRanobe`;
  }, [item]);

  if (missing) notFound();

  if (loading) {
    return (
      <div className={styles.center}>
        <Spinner size={34} />
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className={styles.center}>
        <EmptyState title="Не удалось загрузить новость" body={error || 'Что-то пошло не так.'} />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <Link href="/news" className="btn btn-ghost">
        <ArrowLeft size={15} />
        {'Все новости'}
      </Link>

      <article className={`glass-panel ${styles.article}`}>
        <div className={styles.meta}>
          <span className={styles.icon}>
            <Megaphone size={15} />
          </span>
          <span className={styles.date}>{formatDate(item.created_at)}</span>
          {item.author ? (
            <span className={styles.author}>{`от ${item.author.username}`}</span>
          ) : null}
        </div>
        <h1 className={styles.title}>{item.title}</h1>
        <div className={styles.body}>
          <Markdown source={item.body} />
        </div>
      </article>

      <div className={styles.comments}>
        <CommentSection targetType="announcement" targetId={item.id} />
      </div>
    </div>
  );
}
