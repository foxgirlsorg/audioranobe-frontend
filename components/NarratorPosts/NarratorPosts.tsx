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
import ConfirmDialog from '@/components/ConfirmDialog/ConfirmDialog';
import Section from '@/components/Section/Section';
import styles from './NarratorPosts.module.css';

const EXCERPT_LEN = 260;

interface Draft {
  key: string;
  postId: number | null;
  title: string;
  body: string;
  busy: boolean;
}

function excerpt(markdown: string): { text: string; truncated: boolean } {
  const plain = markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~|]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (plain.length <= EXCERPT_LEN) return { text: plain, truncated: false };
  return { text: plain.slice(0, EXCERPT_LEN).trimEnd(), truncated: true };
}

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

  const [drafts, setDrafts] = useState<Draft[]>([]);
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
    setDrafts((ds) => [...ds, { key: `new-${Date.now()}-${Math.random()}`, postId: null, title: '', body: '', busy: false }]);
  };

  const startEdit = (p: NarratorPost) => {
    setDrafts((ds) =>
      ds.some((d) => d.postId === p.id)
        ? ds
        : [...ds, { key: `edit-${p.id}`, postId: p.id, title: p.title, body: p.body, busy: false }]
    );
  };

  const cancelDraft = (key: string) => setDrafts((ds) => ds.filter((d) => d.key !== key));

  const updateDraft = (key: string, patch: Partial<Draft>) =>
    setDrafts((ds) => ds.map((d) => (d.key === key ? { ...d, ...patch } : d)));

  async function save(e: React.FormEvent<HTMLFormElement>, draft: Draft) {
    e.preventDefault();
    if (!draft.title.trim()) {
      toast('Укажите заголовок', 'error');
      return;
    }
    updateDraft(draft.key, { busy: true });
    try {
      if (draft.postId === null) {
        await api(`/narrators/${narratorId}/posts`, {
          method: 'POST',
          body: { title: draft.title.trim(), body: draft.body },
        });
        toast('Запись опубликована — подписчики получили уведомление');
      } else {
        await api(`/posts/${draft.postId}`, {
          method: 'PATCH',
          body: { title: draft.title.trim(), body: draft.body },
        });
        toast('Запись обновлена');
      }
      cancelDraft(draft.key);
      await load();
    } catch (err) {
      toast(errMsg(err), 'error');
      updateDraft(draft.key, { busy: false });
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

  if (posts !== null && posts.length === 0 && !canEdit && !error) {
    return null;
  }

  const renderEditor = (draft: Draft) => (
    <form className={`glass-panel ${styles.editor}`} onSubmit={(e) => void save(e, draft)} noValidate>
      <div className={styles.field}>
        <label className={styles.label} htmlFor={`post-title-${draft.key}`}>
          {'Заголовок'}
        </label>
        <input
          id={`post-title-${draft.key}`}
          className="input"
          value={draft.title}
          maxLength={200}
          onChange={(e) => updateDraft(draft.key, { title: e.target.value })}
        />
      </div>
      <div className={styles.field}>
        <span className={styles.label}>{'Текст'}</span>
        <MarkdownEditor
          value={draft.body}
          onChange={(v) => updateDraft(draft.key, { body: v })}
          maxLength={20000}
          placeholder={'**Жирный**, *курсив*, [ссылка](https://…), списки…'}
          media="both"
        />
      </div>
      <div className={styles.editorFoot}>
        <button type="button" className="btn btn-ghost" onClick={() => cancelDraft(draft.key)}>
          {'Отмена'}
        </button>
        <button type="submit" className="btn btn-primary" disabled={draft.busy}>
          {draft.busy ? 'Сохраняем…' : draft.postId === null ? 'Опубликовать' : 'Сохранить'}
        </button>
      </div>
    </form>
  );

  return (
    <Section eyebrow="Блог" title="Публичные" accent="записи">
    <div className={styles.wrap}>
      {canEdit ? (
        <button type="button" className="btn btn-primary" onClick={startNew}>
          <Plus size={15} />
          {'Новая запись'}
        </button>
      ) : null}

      {drafts.filter((d) => d.postId === null).map((d) => <React.Fragment key={d.key}>{renderEditor(d)}</React.Fragment>)}

      {error ? (
        <div className={styles.error}>{error}</div>
      ) : posts === null ? (
        <Spinner />
      ) : posts.length === 0 ? (
        <EmptyState title="Записей пока нет" body="Расскажите подписчикам, над чем работаете." />
      ) : (
        <ul className={styles.list}>
          {posts.map((p) => {
            const draft = drafts.find((d) => d.postId === p.id);
            if (draft) {
              return <li key={p.id}>{renderEditor(draft)}</li>;
            }
            const ex = excerpt(p.body);
            return (
              <li key={p.id}>
                <Link href={`/post/${p.id}`} className={`glass-panel ${styles.post}`}>
                  <div className={styles.postHead}>
                    <span className={styles.postTitle}>{p.title}</span>
                    {p.is_hidden ? <span className={styles.hiddenTag}>{'скрыта'}</span> : null}
                  </div>
                  {ex.text ? (
                    <p className={styles.postBody}>
                      {ex.truncated ? `${ex.text}…` : ex.text}
                      {ex.truncated ? <span className={styles.readMore}>{'Читать дальше'}</span> : null}
                    </p>
                  ) : null}
                  <footer className={styles.postFoot}>
                    <span className={styles.postMeta}>{timeAgo(p.created_at)}</span>
                    <span className={styles.postFootRight}>
                      <span className={styles.commentsCount}>
                        <MessageSquare size={13} />
                        {p.comments_count ?? 0}
                      </span>
                      {canEdit ? (
                        <span className={styles.postActions} onClick={(e) => e.preventDefault()}>
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
                    </span>
                  </footer>
                </Link>
              </li>
            );
          })}
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
    </Section>
  );
}
