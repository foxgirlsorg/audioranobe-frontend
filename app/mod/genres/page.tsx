'use client';

import { useEffect, useState } from 'react';
import { BookMarked, Pencil, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { errMsg, useToast } from '@/lib/toast';
import type { Genre, Paginated } from '@/lib/types';
import Spinner from '@/components/Spinner/Spinner';
import EmptyState from '@/components/EmptyState/EmptyState';
import Pagination from '@/components/Pagination/Pagination';
import ConfirmDialog from '@/components/ConfirmDialog/ConfirmDialog';
import Toggle from '@/components/Toggle/Toggle';
import { ModShell, ErrorPanel, splitHeading } from '@/app/mod/modnav';
import styles from './page.module.css';

function GenresContent() {
  const { user: me } = useAuth();
  const { toast } = useToast();
  const isAdmin = me?.role === 'admin';

  const [data, setData] = useState<Paginated<Genre> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [page, setPage] = useState(1);

  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');

  const [toDelete, setToDelete] = useState<Genre | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api<Paginated<Genre>>('/genres', { params: { page, per_page: 50 } })
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

  const createGenre = async () => {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      await api('/genres', { method: 'POST', body: { name } });
      toast('Тег создан');
      setNewName('');
      setReload((n) => n + 1);
    } catch (e) {
      toast(errMsg(e), 'error');
    }
    setCreating(false);
  };

  const startEdit = (g: Genre) => {
    setEditingId(g.id);
    setEditName(g.name);
  };

  const saveEdit = async (g: Genre) => {
    const name = editName.trim();
    if (!name || name === g.name) {
      setEditingId(null);
      return;
    }
    setBusyId(g.id);
    try {
      await api(`/mod/genres/${g.id}`, { method: 'PATCH', body: { name } });
      toast('Тег обновлён');
      setEditingId(null);
      setReload((n) => n + 1);
    } catch (e) {
      toast(errMsg(e), 'error');
    }
    setBusyId(null);
  };

  const toggleSensitive = async (g: Genre) => {
    setBusyId(g.id);
    try {
      const fresh = await api<Genre>(`/mod/genres/${g.id}`, {
        method: 'PATCH',
        body: { is_sensitive: !g.is_sensitive },
      });
      toast(fresh.is_sensitive ? 'Тег помечен как чувствительный' : 'Отметка снята');
      setData((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.map((x) =>
                x.id === g.id ? { ...x, is_sensitive: fresh.is_sensitive } : x
              ),
            }
          : prev
      );
    } catch (e) {
      toast(errMsg(e), 'error');
    }
    setBusyId(null);
  };

  const deleteGenre = async (g: Genre) => {
    setBusyId(g.id);
    try {
      await api(`/mod/genres/${g.id}`, { method: 'DELETE' });
      toast('Тег удалён');
      setData((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.filter((x) => x.id !== g.id),
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
      {isAdmin ? (
        <div className={`glass-panel ${styles.createForm}`}>
          <h3 className={styles.formTitle}>{'Новый тег'}</h3>
          <div className={styles.formRow}>
            <input
              className={`input ${styles.nameInput}`}
              type="text"
              placeholder={'Название тега'}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') createGenre();
              }}
            />
            <button
              type="button"
              className="btn btn-primary"
              disabled={creating || !newName.trim()}
              onClick={createGenre}
            >
              {'Создать'}
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <ErrorPanel message={error} onRetry={() => setReload((n) => n + 1)} />
      ) : loading || !data ? (
        <div className={styles.loading}>
          <Spinner />
        </div>
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={BookMarked}
          title={'Тегов пока нет'}
          body={'Создайте первый тег выше.'}
        />
      ) : (
        <>
          <div className={`glass-panel ${styles.tableWrap}`}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{'Название'}</th>
                  <th>{'Тайтлов'}</th>
                  <th>{'18+ / чувствительный'}</th>
                  {isAdmin ? <th aria-label={'Действия'} /> : null}
                </tr>
              </thead>
              <tbody>
                {data.items.map((g) => {
                  const editing = editingId === g.id;
                  const busy = busyId === g.id;
                  return (
                    <tr key={g.id}>
                      <td>
                        {editing ? (
                          <input
                            className="input"
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveEdit(g);
                              if (e.key === 'Escape') setEditingId(null);
                            }}
                            autoFocus
                          />
                        ) : (
                          <span className={styles.genreName}>{g.name}</span>
                        )}
                      </td>
                      <td className={styles.count}>{g.titles_count}</td>
                      <td>
                        <Toggle
                          checked={g.is_sensitive}
                          disabled={!isAdmin || busy}
                          onChange={() => void toggleSensitive(g)}
                          label={g.is_sensitive ? 'Скрыт для гостей' : 'Виден всем'}
                        />
                      </td>
                      {isAdmin ? (
                        <td>
                          <div className={styles.rowActions}>
                            {editing ? (
                              <>
                                <button
                                  type="button"
                                  className={`btn btn-primary ${styles.smallBtn}`}
                                  disabled={busy || !editName.trim()}
                                  onClick={() => saveEdit(g)}
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
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  className={`btn btn-ghost ${styles.smallBtn}`}
                                  disabled={busy}
                                  onClick={() => startEdit(g)}
                                  title={'Редактировать'}
                                >
                                  <Pencil size={15} />
                                </button>
                                <button
                                  type="button"
                                  className={`btn btn-ghost ${styles.smallBtn}`}
                                  disabled={busy}
                                  onClick={() => setToDelete(g)}
                                  title={'Удалить'}
                                >
                                  <Trash2 size={15} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination
            page={data.page}
            total={data.total}
            perPage={data.per_page}
            onPage={setPage}
          />
        </>
      )}

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete) void deleteGenre(toDelete);
        }}
        title={'Удалить тег'}
        body={
          toDelete
            ? `Удалить тег «${toDelete.name}»? Тайтлы не будут удалены, но потеряют привязку к этому тегу.`
            : ''
        }
        danger
      />
    </div>
  );
}

export default function ModGenresPage() {
  const h = splitHeading('Управление тегами');
  return (
    <ModShell title={h.title} accent={h.accent} adminOnly>
      <GenresContent />
    </ModShell>
  );
}
