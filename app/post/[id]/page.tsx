'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Mic } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { errMsg } from '@/lib/toast';
import { timeAgo } from '@/lib/format';
import type { NarratorPost } from '@/lib/types';
import Spinner from '@/components/Spinner';
import EmptyState from '@/components/EmptyState';
import Markdown from '@/components/Markdown';
import CommentSection from '@/components/CommentSection';
import styles from './page.module.css';

export default function PostPage({ params }: { params: { id: string } }) {
  const postId = Number(params.id);

  const [post, setPost] = useState<NarratorPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [missing, setMissing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setPost(await api<NarratorPost>(`/posts/${postId}`));
      setError('');
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) setMissing(true);
      else setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (post) document.title = `${post.title} — AudioRanobe`;
  }, [post]);

  if (missing) notFound();

  if (loading) {
    return (
      <div className={styles.center}>
        <Spinner size={34} />
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className={styles.center}>
        <EmptyState title="Не удалось загрузить запись" body={error || 'Что-то пошло не так.'} />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {post.narrator ? (
        <Link href={`/narrator/${post.narrator.slug}`} className="btn btn-ghost">
          <ArrowLeft size={15} />
          {post.narrator.name}
        </Link>
      ) : null}

      <article className={`glass-panel ${styles.article}`}>
        <header className={styles.head}>
          <h1 className={styles.title}>{post.title}</h1>
          <div className={styles.meta}>
            {post.narrator ? (
              <Link href={`/narrator/${post.narrator.slug}`} className={styles.author}>
                {post.narrator.avatar_url ? (
                  <img src={post.narrator.avatar_url} alt="" className={styles.avatar} />
                ) : (
                  <span className={styles.avatarFallback}>
                    <Mic size={12} />
                  </span>
                )}
                {post.narrator.name}
              </Link>
            ) : null}
            <span className={styles.date}>{timeAgo(post.created_at)}</span>
            {post.is_hidden ? <span className={styles.hiddenTag}>{'скрыта'}</span> : null}
          </div>
        </header>

        <div className={styles.body}>
          <Markdown source={post.body} />
        </div>
      </article>

      <div className={styles.comments}>
        <CommentSection targetType="post" targetId={post.id} />
      </div>
    </div>
  );
}
