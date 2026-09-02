'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { MessageSquare, CheckCheck, Pencil, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { errMsg, useToast } from '@/lib/toast';
import type { Comment, ModComment, Paginated } from '@/lib/types';
import Spinner from '@/components/Spinner/Spinner';
import EmptyState from '@/components/EmptyState/EmptyState';
import Pagination from '@/components/Pagination/Pagination';
import ConfirmDialog from '@/components/ConfirmDialog/ConfirmDialog';
import { ModShell, ErrorPanel, splitHeading } from '@/app/mod/modnav';
import styles from './page.module.css';

const PER_PAGE = 50;
// A comment taller than this collapses behind "show more" — a wall of text
// (or a spam dump full of blank lines) shouldn't push the rest of the page
// down, however few characters it happens to be.
const MAX_COLLAPSED_HEIGHT = 400;

function CommentsContent() {
  const { toast } = useToast();
  const { can } = useAuth();
  const isAdmin = can('comments.moderate');

  const [data, setData] = useState<Paginated<ModComment> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [page, setPage] = useState(1);
  const [marking, setMarking] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editBody, setEditBody] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [toDelete, setToDelete] = useState<ModComment | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [overflowing, setOverflowing] = useState<Set<number>>(new Set());
  const bodyRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api<Paginated<ModComment>>('/mod/comments', { params: { page, per_page: PER_PAGE } })
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

  // Measure actual rendered height once the page's comments are in the DOM —
  // a fixed character count can't predict height (blank lines, long unbroken
  // tokens, font metrics), a real box height comparison can.
  useEffect(() => {
    if (!data) return;
    const next = new Set<number>();
    bodyRefs.current.forEach((el, id) => {
      if (el.scrollHeight > MAX_COLLAPSED_HEIGHT + 1) next.add(id);
    });
    setOverflowing(next);
  }, [data]);

  const markPageChecked = async () => {
    if (!data) return;
    const ids = data.items.filter((c) => !c.mod_reviewed).map((c) => c.id);
    if (ids.length === 0) return;
    setMarking(true);
    try {
      await api('/mod/comments/mark-checked', { method: 'POST', body: { ids } });
      toast(`Страница отмечена проверенной (${ids.length})`);
      setData((prev) =>
        prev ? { ...prev, items: prev.items.map((c) => ({ ...c, mod_reviewed: true })) } : prev
      );
    } catch (e) {
      toast(errMsg(e), 'error');
    }
    setMarking(false);
  };

  const toggleExpanded = (id: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const startEdit = (c: ModComment) => {
    setEditingId(c.id);
    setEditBody(c.body);
  };

  const saveEdit = async (c: ModComment) => {
    const body = editBody.trim();
    if (!body) return;
    setBusyId(c.id);
    try {
      const updated = await api<Comment>(`/comments/${c.id}`, { method: 'PATCH', body: { body } });
      toast('Комментарий обновлён');
      setEditingId(null);
      setData((prev) =>
        prev ? { ...prev, items: prev.items.map((x) => (x.id === c.id ? { ...x, ...updated } : x)) } : prev
      );
    } catch (e) {
      toast(errMsg(e), 'error');
    }
    setBusyId(null);
  };

  const deleteComment = async (c: ModComment) => {
    setBusyId(c.id);
    try {
      await api(`/comments/${c.id}`, { method: 'DELETE' });
      toast('Комментарий удалён');
      setToDelete(null);
      setData((prev) => {
        if (!prev) return prev;
        // A plain mod can no longer see deleted comments at all — the row
        // disappears. An admin keeps seeing it (with its real body, already
        // known client-side) marked as deleted.
        if (!isAdmin) {
          return { ...prev, items: prev.items.filter((x) => x.id !== c.id), total: Math.max(0, prev.total - 1) };
        }
        return { ...prev, items: prev.items.map((x) => (x.id === c.id ? { ...x, is_deleted: true } : x)) };
      });
    } catch (e) {
      toast(errMsg(e), 'error');
    }
    setBusyId(null);
  };

  if (error) {
    return <ErrorPanel message={error} onRetry={() => setReload((n) => n + 1)} />;
  }
  if (loading || !data) {
    return (
      <div className={styles.loading}>
        <Spinner />
      </div>
    );
  }
  if (data.items.length === 0) {
    return <EmptyState icon={MessageSquare} title={'Комментариев пока нет'} />;
  }

  const uncheckedOnPage = data.items.filter((c) => !c.mod_reviewed).length;

  const markButton = (
    <button
      type="button"
      className="btn btn-primary"
      disabled={marking || uncheckedOnPage === 0}
      onClick={() => void markPageChecked()}
    >
      <CheckCheck size={15} />
      {uncheckedOnPage === 0 ? (
        'Страница проверена'
      ) : (
        <>
          {'Отметить страницу '}
          <span className={styles.hideMobile}>{'проверенной '}</span>
          {`(${uncheckedOnPage})`}
        </>
      )}
    </button>
  );

  return (
    <>
      <div className={styles.toolbar}>
        <p className={styles.hint}>
          {
            'Каждый комментарий на сайте, новые сверху. Отметка "проверено" ставится сразу для всей загруженной страницы — комментарий за комментарием отмечать не нужно.'
          }
        </p>
        {markButton}
      </div>

      <div className={styles.list}>
        {data.items.map((c) => {
          const busy = busyId === c.id;
          const editing = editingId === c.id;
          const isOverflowing = overflowing.has(c.id);
          const isExpanded = expanded.has(c.id);
          const collapsed = isOverflowing && !isExpanded;

          return (
            <div key={c.id} className={`glass-panel ${styles.row}`}>
              <div className={styles.rowHead}>
                <span className={styles.author}>{c.user?.username ?? '[удалён]'}</span>
                {c.target ? (
                  <Link href={c.target.link} target="_blank" className={styles.targetLink}>
                    {c.target.name}
                  </Link>
                ) : (
                  <span className={styles.note}>{'объект удалён'}</span>
                )}
                <span className={styles.spacer} />
                <span className={styles.badges}>
                  <span className={styles.note}>{new Date(c.created_at).toLocaleString('ru-RU')}</span>
                  {c.is_deleted ? <span className={styles.badgeDeleted}>{'удалено'}</span> : null}
                  <span className={c.mod_reviewed ? styles.badgeOk : styles.badgePending}>
                    {c.mod_reviewed ? 'проверено' : 'не проверено'}
                  </span>
                </span>
              </div>

              {editing ? (
                <div className={styles.editBox}>
                  <textarea
                    className="textarea"
                    rows={4}
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    autoFocus
                  />
                  <div className={styles.editActions}>
                    <button
                      type="button"
                      className={`btn btn-primary ${styles.smallBtn}`}
                      disabled={busy || !editBody.trim()}
                      onClick={() => void saveEdit(c)}
                    >
                      {'Сохранить'}
                    </button>
                    <button
                      type="button"
                      className={`btn btn-ghost ${styles.smallBtn}`}
                      onClick={() => setEditingId(null)}
                    >
                      {'Отмена'}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div
                    ref={(el) => {
                      if (el) bodyRefs.current.set(c.id, el);
                      else bodyRefs.current.delete(c.id);
                    }}
                    className={[
                      c.is_deleted ? styles.bodyDeleted : styles.body,
                      collapsed ? styles.bodyCollapsed : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    style={collapsed ? { maxHeight: MAX_COLLAPSED_HEIGHT } : undefined}
                  >
                    {c.body}
                  </div>
                  {isOverflowing ? (
                    <button type="button" className={styles.expandBtn} onClick={() => toggleExpanded(c.id)}>
                      {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      {isExpanded ? 'Свернуть' : 'Показать полностью'}
                    </button>
                  ) : null}
                  {!c.is_deleted ? (
                    <div className={styles.rowActions}>
                      <button
                        type="button"
                        className={`btn btn-ghost ${styles.smallBtn}`}
                        disabled={busy}
                        onClick={() => startEdit(c)}
                        title={'Редактировать'}
                      >
                        <Pencil size={13} /> {'Изменить'}
                      </button>
                      <button
                        type="button"
                        className={`btn btn-ghost ${styles.smallBtn}`}
                        disabled={busy}
                        onClick={() => setToDelete(c)}
                        title={'Удалить'}
                      >
                        <Trash2 size={13} /> {'Удалить'}
                      </button>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          );
        })}
      </div>

      <Pagination page={data.page} total={data.total} perPage={data.per_page} onPage={setPage} />

      <div className={styles.bottomBar}>{markButton}</div>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete) void deleteComment(toDelete);
        }}
        title={'Удалить комментарий'}
        body={toDelete ? `Удалить комментарий пользователя «${toDelete.user?.username ?? '[удалён]'}»?` : ''}
        danger
      />
    </>
  );
}

export default function ModCommentsPage() {
  const h = splitHeading('Все комментарии');
  return (
    <ModShell title={h.title} accent={h.accent} perm="comments.moderate">
      <CommentsContent />
    </ModShell>
  );
}
