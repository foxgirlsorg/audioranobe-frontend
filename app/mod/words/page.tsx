'use client';

import { useEffect, useState } from 'react';
import { Filter, Pencil, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { errMsg, useToast } from '@/lib/toast';
import type { BannedWord, Paginated } from '@/lib/types';
import Spinner from '@/components/Spinner/Spinner';
import EmptyState from '@/components/EmptyState/EmptyState';
import Pagination from '@/components/Pagination/Pagination';
import ConfirmDialog from '@/components/ConfirmDialog/ConfirmDialog';
import { ModShell, ErrorPanel, splitHeading } from '@/app/mod/modnav';
import Select, { type SelectOption } from '@/components/Select/Select';
import styles from './page.module.css';

type MatchMode = BannedWord['match_mode'];

const MODE_LABELS: Record<MatchMode, string> = {
  substring: 'Подстрока',
  word: 'Целое слово',
};

const MODE_OPTIONS: SelectOption<MatchMode>[] = (
  Object.keys(MODE_LABELS) as MatchMode[]
).map((m) => ({ value: m, label: MODE_LABELS[m] }));

function WordsContent() {
  const { toast } = useToast();

  const [data, setData] = useState<Paginated<BannedWord> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [page, setPage] = useState(1);

  const [newWord, setNewWord] = useState('');
  const [newMode, setNewMode] = useState<BannedWord['match_mode']>('substring');
  const [newNote, setNewNote] = useState('');
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editWord, setEditWord] = useState('');
  const [editMode, setEditMode] = useState<BannedWord['match_mode']>('substring');

  const [toDelete, setToDelete] = useState<BannedWord | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api<Paginated<BannedWord>>('/mod/words', { params: { page, per_page: 50 } })
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

  const createWord = async () => {
    const word = newWord.trim();
    if (!word) return;
    setCreating(true);
    try {
      await api('/mod/words', {
        method: 'POST',
        body: { word, match_mode: newMode, note: newNote.trim() },
      });
      toast('Слово добавлено в фильтр');
      setNewWord('');
      setNewNote('');
      setNewMode('substring');
      setReload((n) => n + 1);
    } catch (e) {
      toast(errMsg(e), 'error');
    }
    setCreating(false);
  };

  const startEdit = (w: BannedWord) => {
    setEditingId(w.id);
    setEditWord(w.word);
    setEditMode(w.match_mode);
  };

  const saveEdit = async (w: BannedWord) => {
    const word = editWord.trim();
    if (!word) {
      setEditingId(null);
      return;
    }
    if (word === w.word && editMode === w.match_mode) {
      setEditingId(null);
      return;
    }
    setBusyId(w.id);
    try {
      await api(`/mod/words/${w.id}`, { method: 'PATCH', body: { word, match_mode: editMode } });
      toast('Слово обновлено');
      setEditingId(null);
      setReload((n) => n + 1);
    } catch (e) {
      toast(errMsg(e), 'error');
    }
    setBusyId(null);
  };

  const deleteWord = async (w: BannedWord) => {
    setBusyId(w.id);
    try {
      await api(`/mod/words/${w.id}`, { method: 'DELETE' });
      toast('Слово удалено из фильтра');
      setData((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.filter((x) => x.id !== w.id),
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
      <div className={`glass-panel ${styles.createForm}`}>
        <h3 className={styles.formTitle}>{'Новое запрещённое слово'}</h3>
        <p className={styles.hint}>
          {
            'Фильтр применяется ко всем текстам на сайте: названиям, описаниям, био, комментариям, именам пользователей и slug-ам. Сравнение регистронезависимое и устойчиво к разделителям, повторам букв и подмене латиницы на кириллицу.'
          }
        </p>
        <div className={styles.formRow}>
          <input
            className={`input ${styles.wordInput}`}
            type="text"
            placeholder={'Слово'}
            value={newWord}
            onChange={(e) => setNewWord(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void createWord();
            }}
          />
          <Select<MatchMode>
            className={styles.modeSelect}
            value={newMode}
            options={MODE_OPTIONS}
            onChange={setNewMode}
            ariaLabel="Режим совпадения"
          />
          <input
            className={`input ${styles.noteInput}`}
            type="text"
            placeholder={'Комментарий (необязательно)'}
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
          />
          <button
            type="button"
            className="btn btn-primary"
            disabled={creating || !newWord.trim()}
            onClick={() => void createWord()}
          >
            {'Добавить'}
          </button>
        </div>
      </div>

      {error ? (
        <ErrorPanel message={error} onRetry={() => setReload((n) => n + 1)} />
      ) : loading || !data ? (
        <div className={styles.loading}>
          <Spinner />
        </div>
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={Filter}
          title={'Фильтр пуст'}
          body={'Добавьте первое запрещённое слово выше.'}
        />
      ) : (
        <>
          <div className={`glass-panel ${styles.tableWrap}`}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{'Слово'}</th>
                  <th>{'Режим'}</th>
                  <th>{'Комментарий'}</th>
                  <th>{'Добавил'}</th>
                  <th aria-label={'Действия'} />
                </tr>
              </thead>
              <tbody>
                {data.items.map((w) => {
                  const editing = editingId === w.id;
                  const busy = busyId === w.id;
                  return (
                    <tr key={w.id}>
                      <td>
                        {editing ? (
                          <input
                            className="input"
                            type="text"
                            value={editWord}
                            onChange={(e) => setEditWord(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') void saveEdit(w);
                              if (e.key === 'Escape') setEditingId(null);
                            }}
                            autoFocus
                          />
                        ) : (
                          <span className={styles.word}>{w.word}</span>
                        )}
                      </td>
                      <td>
                        {editing ? (
                          <Select<MatchMode>
                            size="sm"
                            value={editMode}
                            options={MODE_OPTIONS}
                            onChange={setEditMode}
                            ariaLabel="Режим совпадения"
                          />
                        ) : (
                          <span className={styles.mode}>{MODE_LABELS[w.match_mode]}</span>
                        )}
                      </td>
                      <td className={styles.note}>{w.note || '—'}</td>
                      <td className={styles.note}>{w.created_by ?? '—'}</td>
                      <td>
                        <div className={styles.rowActions}>
                          {editing ? (
                            <>
                              <button
                                type="button"
                                className={`btn btn-primary ${styles.smallBtn}`}
                                disabled={busy || !editWord.trim()}
                                onClick={() => void saveEdit(w)}
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
                                onClick={() => startEdit(w)}
                                title={'Редактировать'}
                              >
                                <Pencil size={15} />
                              </button>
                              <button
                                type="button"
                                className={`btn btn-ghost ${styles.smallBtn}`}
                                disabled={busy}
                                onClick={() => setToDelete(w)}
                                title={'Удалить'}
                              >
                                <Trash2 size={15} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={data.page} total={data.total} perPage={data.per_page} onPage={setPage} />
        </>
      )}

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete) void deleteWord(toDelete);
        }}
        title={'Удалить слово'}
        body={toDelete ? `Убрать «${toDelete.word}» из фильтра?` : ''}
        danger
      />
    </div>
  );
}

export default function ModWordsPage() {
  const h = splitHeading('Фильтр слов');
  return (
    <ModShell title={h.title} accent={h.accent} adminOnly>
      <WordsContent />
    </ModShell>
  );
}
