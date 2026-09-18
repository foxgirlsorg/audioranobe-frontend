'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Mic, Pencil } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { errMsg, useToast } from '@/lib/toast';
import { timeAgo } from '@/lib/format';
import type { NarratorPost } from '@/lib/types';
import { usePageTitle } from '@/lib/usePageTitle';
import Spinner from '@/components/Spinner/Spinner';
import EmptyState from '@/components/EmptyState/EmptyState';
import Markdown from '@/components/Markdown/Markdown';
import MarkdownEditor from '@/components/MarkdownEditor/MarkdownEditor';
import CommentSection from '@/components/CommentSection/CommentSection';
import styles from './page.module.css';

export default function PostPage({ params }: { params: { id: string } }) {
  const postId = Number(params.id);

  const { toast } = useToast();
  const [post, setPost] = useState<NarratorPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [missing, setMissing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

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

  usePageTitle(post?.title);

  const startEdit = () => {
    if (!post) return;
    setTitle(post.title);
    setBody(post.body);
    setEditing(true);
  };

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!title.trim()) {
      toast('Укажите заголовок', 'error');
      return;
    }
    setBusy(true);
    try {
      const updated = await api<NarratorPost>(`/posts/${postId}`, {
        method: 'PATCH',
        body: { title: title.trim(), body },
      });
      setPost(updated);
      setEditing(false);
      toast('Запись обновлена');
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setBusy(false);
    }
  }

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

      <article className={styles.article}>
        {editing ? (
          <form className={`glass-panel ${styles.editor}`} onSubmit={save} noValidate>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="post-title">
                {'Заголовок'}
              </label>
              <input
                id="post-title"
                className="input"
                value={title}
                maxLength={200}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className={styles.field}>
              <span className={styles.label}>{'Текст'}</span>
              <MarkdownEditor
                value={body}
                onChange={setBody}
                maxLength={20000}
                placeholder={'**Жирный**, *курсив*, [ссылка](https://…), списки…'}
                media="both"
              />
            </div>
            <div className={styles.editorFoot}>
              <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)}>
                {'Отмена'}
              </button>
              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy ? 'Сохраняем…' : 'Сохранить'}
              </button>
            </div>
          </form>
        ) : (
          <>
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
                {post.can_edit ? (
                  <button type="button" className={`btn btn-ghost ${styles.editBtn}`} onClick={startEdit} title="Редактировать">
                    <Pencil size={13} />
                  </button>
                ) : null}
              </div>
            </header>

            <div className={styles.body}>
              <Markdown source={post.body} media="both" />
            </div>
          </>
        )}
      </article>

      <div className={styles.comments}>
        <CommentSection targetType="post" targetId={post.id} initialComments={post.comments} />
      </div>
    </div>
  );
}
