'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Eye, EyeOff, MessageSquare, Pencil, Plus, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { errMsg, useToast } from '@/lib/toast';
import { timeAgo } from '@/lib/format';
import type { NarratorPost, Paginated } from '@/lib/types';
import Spinner from '@/components/Spinner/Spinner';
import MarkdownEditor from '@/components/MarkdownEditor/MarkdownEditor';
import EmptyState from '@/components/EmptyState/EmptyState';
import Markdown from '@/components/Markdown/Markdown';
import Collapsible from '@/components/Collapsible/Collapsible';
import ConfirmDialog from '@/components/ConfirmDialog/ConfirmDialog';
import styles from './NarratorPosts.module.css';

export default function NarratorPosts({
  narratorId,
  canEdit,
}: {
  narratorId: number;
  canEdit: boolean;
}) {
  const { toast } = useToast();
  const [posts, setPosts] = useState<NarratorPost[] | null>(null);
  const [error, setError] = useState('');

  const [editing, setEditing] = useState<NarratorPost | 'new' | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [toDelete, setToDelete] = useState<NarratorPost | null>(null);

  const load = useCallback(async () => {
    try {
      setError('');
      const d = await api<Paginated<NarratorPost>>(`/narrators/${narratorId}/posts`, {
        params: { per_page: 50 },
      });
      setPosts(d.items ?? []);
    } catch (e) {
      setError(errMsg(e));
    }
  }, [narratorId]);

  useEffect(() => {
    void load();
  }, [load]);

  const startNew = () => {
    setEditing('new');
    setTitle('');
    setBody('');
  };

  const startEdit = (p: NarratorPost) => {
    setEditing(p);
    setTitle(p.title);
    setBody(p.body);
  };

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!title.trim()) {
      toast('Укажите заголовок', 'error');
      return;
    }
    setBusy(true);
    try {
      if (editing === 'new') {
        await api(`/narrators/${narratorId}/posts`, {
          method: 'POST',
          body: { title: title.trim(), body },
        });
        toast('Запись опубликована — подписчики получили уведомление');
      } else if (editing) {
        await api(`/posts/${editing.id}`, {
          method: 'PATCH',
          body: { title: title.trim(), body },
        });
        toast('Запись обновлена');
      }
      setEditing(null);
      await load();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function toggleHidden(p: NarratorPost) {
    try {
      await api(`/posts/${p.id}`, { method: 'PATCH', body: { is_hidden: !p.is_hidden } });
      await load();
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  }

  async function remove(p: NarratorPost) {
    try {
      await api(`/posts/${p.id}`, { method: 'DELETE' });
      toast('Запись удалена');
      setToDelete(null);
      await load();
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  }

  return (
    <div className={styles.wrap}>
      {canEdit && editing === null ? (
        <button type="button" className="btn btn-primary" onClick={startNew}>
          <Plus size={15} />
          {'Новая запись'}
        </button>
      ) : null}

      {editing !== null ? (
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
            />
          </div>
          <div className={styles.editorFoot}>
            <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>
              {'Отмена'}
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Сохраняем…' : editing === 'new' ? 'Опубликовать' : 'Сохранить'}
            </button>
          </div>
        </form>
      ) : null}

      {error ? (
        <div className={styles.error}>{error}</div>
      ) : posts === null ? (
        <Spinner />
      ) : posts.length === 0 ? (
        <EmptyState title="Записей пока нет" body="Расскажите подписчикам, над чем работаете." />
      ) : (
        <ul className={styles.list}>
          {posts.map((p) => (
            <li key={p.id} className={`glass-panel ${styles.post}`}>
              <header className={styles.postHead}>
                <Link href={`/post/${p.id}`} className={styles.postTitle}>
                  {p.title}
                </Link>
                <span className={styles.postMeta}>{timeAgo(p.created_at)}</span>
                {p.is_hidden ? <span className={styles.hiddenTag}>{'скрыта'}</span> : null}
              </header>
              <Collapsible maxHeight={220}>
                <div className={styles.postBody}>
                  <Markdown source={p.body} />
                </div>
              </Collapsible>
              <footer className={styles.postFoot}>
                <Link href={`/post/${p.id}`} className={styles.commentsLink}>
                  <MessageSquare size={13} />
                  {'Комментарии'}
                </Link>
                {canEdit ? (
                  <span className={styles.postActions}>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => void toggleHidden(p)}
                      title={p.is_hidden ? 'Показать' : 'Скрыть'}
                    >
                      {p.is_hidden ? <Eye size={14} /> : <EyeOff size={14} />}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => startEdit(p)}
                      title="Редактировать"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => setToDelete(p)}
                      title="Удалить"
                    >
                      <Trash2 size={14} />
                    </button>
                  </span>
                ) : null}
              </footer>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete) void remove(toDelete);
        }}
        title="Удалить запись"
        body={toDelete ? `Удалить «${toDelete.title}»? Комментарии к ней тоже пропадут.` : ''}
        danger
      />
    </div>
  );
}
