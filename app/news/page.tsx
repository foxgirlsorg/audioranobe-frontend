'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Eye,
  EyeOff,
  Home,
  Megaphone,
  Newspaper,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { api } from '@/lib/api';
import { LIMITS } from '@/lib/limits';
import type { Announcement, Paginated } from '@/lib/types';
import { errMsg, useToast } from '@/lib/toast';
import { formatDate } from '@/lib/format';
import { useAuth } from '@/lib/auth';
import { useInfiniteList } from '@/lib/useInfiniteList';
import InfiniteScroll from '@/components/InfiniteScroll/InfiniteScroll';
import Spinner from '@/components/Spinner/Spinner';
import EmptyState from '@/components/EmptyState/EmptyState';
import Markdown from '@/components/Markdown/Markdown';
import Modal from '@/components/Modal/Modal';
import MarkdownEditor from '@/components/MarkdownEditor/MarkdownEditor';
import ConfirmDialog from '@/components/ConfirmDialog/ConfirmDialog';
import Toggle from '@/components/Toggle/Toggle';
import AddCard from '@/components/AddCard/AddCard';
import styles from './page.module.css';

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
      size="wide"
    >
      <div className={styles.editor}>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>{'Название'}</span>
          <input
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={'Что нового?'}
            maxLength={LIMITS.announcementTitle}
          />
        </label>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>{'Текст'}</span>
          <MarkdownEditor
            value={body}
            onChange={setBody}
            maxLength={LIMITS.announcementBody}
            placeholder={'**Подробности**, [ссылки](https://…) — всё, что стоит знать сообществу…'}
            media="both"
          />
        </div>
        <Toggle checked={published} onChange={setPublished} label="Опубликовано" />
        <Toggle
          checked={hidden}
          onChange={setHidden}
          label="Скрыть с главной (остаётся в разделе «Новости»)"
        />
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

export default function NewsPage() {
  const { can } = useAuth();
  const isAdmin = can('announcements.manage');
  const { toast } = useToast();
  const [busyId, setBusyId] = useState<number | null>(null);
  const [editor, setEditor] = useState<{ a: Announcement | null } | null>(null);
  const [toDelete, setToDelete] = useState<Announcement | null>(null);

  const fetchPage = useCallback(
    (page: number) =>
      api<Paginated<Announcement>>(isAdmin ? '/mod/announcements' : '/announcements', {
        params: { page },
      }),
    [isAdmin]
  );
  const list = useInfiniteList<Announcement>(fetchPage);

  const onSaved = (a: Announcement, created: boolean) => {
    if (created) {
      list.reload();
    } else {
      list.patch((x) => x.id === a.id, () => a);
    }
    toast(created ? 'Объявление создано' : 'Объявление обновлено');
  };

  const togglePublish = async (a: Announcement) => {
    setBusyId(a.id);
    try {
      const updated = await api<Announcement>(`/mod/announcements/${a.id}`, {
        method: 'PATCH',
        body: { is_published: !a.is_published },
      });
      list.patch((x) => x.id === updated.id, () => updated);
      toast(updated.is_published ? 'Опубликовано' : 'Снято с публикации');
    } catch (e) {
      toast(errMsg(e), 'error');
    }
    setBusyId(null);
  };

  const toggleHidden = async (a: Announcement) => {
    setBusyId(a.id);
    try {
      const updated = await api<Announcement>(`/mod/announcements/${a.id}`, {
        method: 'PATCH',
        body: { is_hidden: !a.is_hidden },
      });
      list.patch((x) => x.id === updated.id, () => updated);
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
      list.remove((x) => x.id === a.id);
    } catch (e) {
      toast(errMsg(e), 'error');
    }
    setBusyId(null);
  };

  return (
    <div className={styles.page}>
      <header className={styles.pageHead}>
        <div className="eyebrow">{'Что происходит на AudioRanobe'}</div>
        <h1 className={styles.pageTitle}>
          {'Новости'} <span>{'сайта'}</span>
        </h1>
      </header>

      {isAdmin ? (
        <div className={styles.topRow}>
          <AddCard icon={Plus} label="Новое объявление" onClick={() => setEditor({ a: null })} />
        </div>
      ) : null}

      {list.loading && !list.items ? (
        <div className={styles.center}>
          <Spinner size={34} />
        </div>
      ) : list.error ? (
        <div className={styles.center}>
          <EmptyState icon={AlertTriangle} title={'Не удалось загрузить новости'} body={list.error} />
          <button type="button" className="btn" onClick={list.reload}>
            {'Попробовать ещё раз'}
          </button>
        </div>
      ) : !list.items || list.items.length === 0 ? (
        <EmptyState
          icon={Newspaper}
          title={'Объявлений пока нет'}
          body={'Когда команда опубликует новости, они появятся здесь.'}
        />
      ) : (
        <>
          <div className={styles.list}>
            {list.items.map((a) => (
              <article key={a.id} className={`glass-panel ${styles.card}`}>
                <div className={styles.cardHead}>
                  <span className={styles.cardIcon}>
                    <Megaphone size={15} />
                  </span>
                  <span className={styles.cardDate}>{formatDate(a.created_at)}</span>
                  {a.author ? (
                    <span className={styles.cardAuthor}>
                      {`от ${a.author.username}`}
                    </span>
                  ) : null}
                  {isAdmin && !a.is_published ? (
                    <span className={styles.chipDraft}>{'черновик'}</span>
                  ) : null}
                  {isAdmin && a.is_hidden ? (
                    <span className={styles.chipDraft}>{'не на главной'}</span>
                  ) : null}
                </div>
                <h2 className={styles.cardTitle}>
                  <Link href={`/news/${a.slug}`} className={styles.cardLink}>
                    {a.title}
                  </Link>
                </h2>
                {a.body ? (
                  <div className={styles.cardBody}>
                    <Markdown source={a.body} media="both" />
                  </div>
                ) : null}
                {a.is_published ? (
                  <Link href={`/news/${a.slug}`} className={styles.cardMore}>
                    {'Читать полностью'}
                  </Link>
                ) : null}
                {isAdmin ? (
                  <div className={styles.cardActions}>
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
                ) : null}
              </article>
            ))}
          </div>
          <InfiniteScroll
            hasMore={list.hasMore}
            loading={list.loadingMore}
            error={list.moreError}
            onLoad={list.loadMore}
            total={list.total}
            shown={list.items.length}
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
        body={toDelete ? `Удалить „${toDelete.title}"? Это действие нельзя отменить.` : ''}
        danger
      />
    </div>
  );
}
