'use client';

import { useEffect, useState } from 'react';
import { Eye, EyeOff, Home, Megaphone, Pencil, Plus, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { errMsg, useToast } from '@/lib/toast';
import { formatDate } from '@/lib/format';
import type { Announcement, Paginated } from '@/lib/types';
import Spinner from '@/components/Spinner';
import EmptyState from '@/components/EmptyState';
import Pagination from '@/components/Pagination';
import Modal from '@/components/Modal';
import Markdown from '@/components/Markdown';
import ConfirmDialog from '@/components/ConfirmDialog';
import { ModShell, ErrorPanel, splitHeading } from '@/app/mod/modnav';
import styles from './page.module.css';

function excerpt(body: string): string {
  return body.length > 180 ? `${body.slice(0, 180)}…` : body;
}

function EditorModal({
  initial,
  onClose,
  onSaved,
}: {
  initial: Announcement | null;
  onClose: () => void;
  onSaved: (a: Announcement, created: boolean) => void;
}) {
  const { toast } = useToast();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [body, setBody] = useState(initial?.body ?? '');
  const [published, setPublished] = useState(initial ? initial.is_published : true);
  const [hidden, setHidden] = useState(initial ? initial.is_hidden : false);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!title.trim()) {
      toast('Укажите название', 'error');
      return;
    }
    setBusy(true);
    try {
      const payload = {
        title: title.trim(),
        body,
        is_published: published,
        is_hidden: hidden,
      };
      const saved = initial
        ? await api<Announcement>(`/mod/announcements/${initial.id}`, {
            method: 'PATCH',
            body: payload,
          })
        : await api<Announcement>('/mod/announcements', { method: 'POST', body: payload });
      onSaved(saved, !initial);
      onClose();
    } catch (e) {
      toast(errMsg(e), 'error');
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={initial ? 'Редактировать объявление' : 'Новое объявление'}
    >
      <div className={styles.editor}>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>{'Название'}</span>
          <input
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={'Что нового?'}
            maxLength={200}
          />
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>
            {'Текст'} <span className={styles.hintInline}>{'поддерживается Markdown'}</span>
          </span>
          <textarea
            className="textarea"
            rows={8}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={'**Подробности**, [ссылки](https://…) — всё, что стоит знать сообществу…'}
          />
        </label>
        {body.trim() ? (
          <div className={styles.preview}>
            <span className={styles.fieldLabel}>{'Предпросмотр'}</span>
            <Markdown source={body} />
          </div>
        ) : null}
        <label className={styles.checkRow}>
          <input
            type="checkbox"
            checked={published}
            onChange={(e) => setPublished(e.target.checked)}
          />
          <span>{'Опубликовано'}</span>
        </label>
        <label className={styles.checkRow}>
          <input type="checkbox" checked={hidden} onChange={(e) => setHidden(e.target.checked)} />
          <span>{'Скрыть с главной (остаётся в разделе «Новости»)'}</span>
        </label>
        <div className={styles.editorActions}>
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={onClose}>
            {'Отмена'}
          </button>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={save}>
            {initial ? 'Сохранить изменения' : 'Создать'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function AnnouncementsContent() {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<Announcement> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [editor, setEditor] = useState<{ a: Announcement | null } | null>(null);
  const [toDelete, setToDelete] = useState<Announcement | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api<Paginated<Announcement>>('/mod/announcements', { params: { page } })
      .then((d) => {
        if (alive) {
          setData(d);
          setError('');
        }
      })
      .catch((e) => {
        if (alive) setError(errMsg(e));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [page, reload]);

  const onSaved = (a: Announcement, created: boolean) => {
    setData((prev) => {
      if (!prev) return prev;
      if (created) return { ...prev, items: [a, ...prev.items], total: prev.total + 1 };
      return { ...prev, items: prev.items.map((x) => (x.id === a.id ? a : x)) };
    });
    toast(created ? 'Объявление создано' : 'Объявление обновлено');
  };

  const togglePublish = async (a: Announcement) => {
    setBusyId(a.id);
    try {
      const updated = await api<Announcement>(`/mod/announcements/${a.id}`, {
        method: 'PATCH',
        body: { is_published: !a.is_published },
      });
      setData((prev) =>
        prev
          ? { ...prev, items: prev.items.map((x) => (x.id === updated.id ? updated : x)) }
          : prev
      );
      toast(updated.is_published ? 'Опубликовано' : 'Снято с публикации');
    } catch (e) {
      toast(errMsg(e), 'error');
    }
    setBusyId(null);
  };

  /** Hides the announcement from the home page only; /news still lists it. */
  const toggleHidden = async (a: Announcement) => {
    setBusyId(a.id);
    try {
      const updated = await api<Announcement>(`/mod/announcements/${a.id}`, {
        method: 'PATCH',
        body: { is_hidden: !a.is_hidden },
      });
      setData((prev) =>
        prev
          ? { ...prev, items: prev.items.map((x) => (x.id === updated.id ? updated : x)) }
          : prev
      );
      toast(updated.is_hidden ? 'Скрыто с главной' : 'Показывается на главной');
    } catch (e) {
      toast(errMsg(e), 'error');
    }
    setBusyId(null);
  };

  const remove = async (a: Announcement) => {
    setBusyId(a.id);
    try {
      await api(`/mod/announcements/${a.id}`, { method: 'DELETE' });
      toast('Объявление удалено');
      setData((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.filter((x) => x.id !== a.id),
              total: Math.max(0, prev.total - 1),
            }
          : prev
      );
    } catch (e) {
      toast(errMsg(e), 'error');
    }
    setBusyId(null);
  };

  return (
    <div>
      <div className={styles.topRow}>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setEditor({ a: null })}
        >
          <Plus size={15} /> {'Новое объявление'}
        </button>
      </div>

      {error ? (
        <ErrorPanel message={error} onRetry={() => setReload((n) => n + 1)} />
      ) : loading || !data ? (
        <div className={styles.loading}>
          <Spinner />
        </div>
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title={'Объявлений пока нет'}
          body={'Напишите первое — на главной для него уже есть место.'}
        />
      ) : (
        <>
          <div className={styles.list}>
            {data.items.map((a) => (
              <article key={a.id} className={`glass-panel ${styles.row}`}>
                <div className={styles.rowMain}>
                  <div className={styles.rowHead}>
                    <h3 className={styles.rowTitle}>{a.title}</h3>
                    <span className={a.is_published ? styles.chipLive : styles.chipDraft}>
                      {a.is_published ? 'опубликовано' : 'черновик'}
                    </span>
                    {a.is_hidden ? (
                      <span className={styles.chipDraft}>{'не на главной'}</span>
                    ) : null}
                  </div>
                  {a.body ? <p className={styles.excerpt}>{excerpt(a.body)}</p> : null}
                  <div className={styles.rowMeta}>
                    {a.author ? <>{'от'} {a.author.username} · </> : null}
                    {formatDate(a.created_at)}
                  </div>
                </div>
                <div className={styles.rowActions}>
                  <button
                    type="button"
                    className={`btn ${styles.smallBtn}`}
                    disabled={busyId === a.id}
                    onClick={() => togglePublish(a)}
                  >
                    {a.is_published ? (
                      <>
                        <EyeOff size={14} /> {'Снять с публикации'}
                      </>
                    ) : (
                      <>
                        <Eye size={14} /> {'Опубликовать'}
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    className={`btn ${styles.smallBtn}`}
                    disabled={busyId === a.id}
                    onClick={() => toggleHidden(a)}
                    title={
                      a.is_hidden
                        ? 'Вернуть на главную'
                        : 'Скрыть с главной, оставив в разделе «Новости»'
                    }
                  >
                    <Home size={14} /> {a.is_hidden ? 'Вернуть на главную' : 'Убрать с главной'}
                  </button>
                  <button
                    type="button"
                    className={`btn ${styles.smallBtn}`}
                    disabled={busyId === a.id}
                    onClick={() => setEditor({ a })}
                  >
                    <Pencil size={14} /> {'Изменить'}
                  </button>
                  <button
                    type="button"
                    className={`btn btn-danger ${styles.smallBtn}`}
                    disabled={busyId === a.id}
                    onClick={() => setToDelete(a)}
                  >
                    <Trash2 size={14} /> {'Удалить'}
                  </button>
                </div>
              </article>
            ))}
          </div>
          <Pagination
            page={data.page}
            total={data.total}
            perPage={data.per_page}
            onPage={setPage}
          />
        </>
      )}

      {editor ? (
        <EditorModal initial={editor.a} onClose={() => setEditor(null)} onSaved={onSaved} />
      ) : null}

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete) void remove(toDelete);
        }}
        title={'Удалить объявление'}
        body={
          toDelete
            ? `Удалить „${toDelete.title}"? Это действие нельзя отменить.`
            : ''
        }
        danger
      />
    </div>
  );
}

export default function ModAnnouncementsPage() {
  const h = splitHeading('Объявления сайта');
  return (
    <ModShell title={h.title} accent={h.accent} adminOnly>
      <AnnouncementsContent />
    </ModShell>
  );
}
