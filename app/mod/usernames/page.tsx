'use client';

import { useCallback, useEffect, useState } from 'react';
import { Lock, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { errMsg, useToast } from '@/lib/toast';
import { formatDate } from '@/lib/format';
import type { Paginated, ReservedUsername } from '@/lib/types';
import Spinner from '@/components/Spinner/Spinner';
import EmptyState from '@/components/EmptyState/EmptyState';
import ConfirmDialog from '@/components/ConfirmDialog/ConfirmDialog';
import InfiniteScroll from '@/components/InfiniteScroll/InfiniteScroll';
import { useInfiniteList } from '@/lib/useInfiniteList';
import { ModShell, ErrorPanel, splitHeading } from '@/app/mod/modnav';
import styles from './page.module.css';

const USERNAME_RE = /^[A-Za-z0-9_]{3,30}$/;

function UsernamesContent() {
  const { toast } = useToast();

  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [newName, setNewName] = useState('');
  const [newNote, setNewNote] = useState('');
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState<ReservedUsername | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setQuery(q.trim()), 300);
    return () => window.clearTimeout(t);
  }, [q]);

  const fetchPage = useCallback(
    (page: number) =>
      api<Paginated<ReservedUsername>>('/mod/usernames', {
        params: { q: query, page, per_page: 50 },
      }),
    [query]
  );
  const list = useInfiniteList<ReservedUsername>(fetchPage);

  const valid = USERNAME_RE.test(newName.trim());

  const create = async () => {
    const username = newName.trim();
    if (!valid) return;
    setCreating(true);
    try {
      await api('/mod/usernames', {
        method: 'POST',
        body: { username, note: newNote.trim() },
      });
      toast(`Имя ${username} зарезервировано`);
      setNewName('');
      setNewNote('');
      list.reload();
    } catch (e) {
      toast(errMsg(e), 'error');
    }
    setCreating(false);
  };

  const remove = async (r: ReservedUsername) => {
    setBusyId(r.id);
    try {
      await api(`/mod/usernames/${r.id}`, { method: 'DELETE' });
      toast(`Имя ${r.username} освобождено`);
      list.remove((x) => x.id === r.id);
    } catch (e) {
      toast(errMsg(e), 'error');
    }
    setBusyId(null);
  };

  return (
    <div>
      <div className={`glass-panel ${styles.createForm}`}>
        <h3 className={styles.formTitle}>{'Зарезервировать имя'}</h3>
        <p className={styles.hint}>
          {
            'Зарезервированное имя нельзя занять — ни при регистрации, ни при входе через сервис, ни переименованием в настройках. Регистр не важен. Тем, кто пытается, сайт отвечает, что имя занято, и не упоминает список.'
          }
        </p>
        <div className={styles.formRow}>
          <input
            className={`input ${styles.nameInput}`}
            type="text"
            placeholder={'Имя пользователя'}
            value={newName}
            maxLength={30}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void create();
            }}
          />
          <input
            className={`input ${styles.noteInput}`}
            type="text"
            placeholder={'Комментарий — зачем (необязательно)'}
            value={newNote}
            maxLength={500}
            onChange={(e) => setNewNote(e.target.value)}
          />
          <button
            type="button"
            className="btn btn-primary"
            disabled={creating || !valid}
            onClick={() => void create()}
          >
            {'Зарезервировать'}
          </button>
        </div>
        {newName.trim() !== '' && !valid ? (
          <p className={styles.formError}>
            {'3–30 символов: латинские буквы, цифры и подчёркивание'}
          </p>
        ) : null}
      </div>

      <div className={styles.searchRow}>
        <input
          className={`input ${styles.search}`}
          type="search"
          placeholder={'Поиск по списку'}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {list.error ? (
        <ErrorPanel message={list.error} onRetry={list.reload} />
      ) : list.loading || !list.items ? (
        <div className={styles.loading}>
          <Spinner />
        </div>
      ) : list.items.length === 0 ? (
        <EmptyState
          icon={Lock}
          title={query ? 'Ничего не найдено' : 'Список пуст'}
          body={
            query
              ? 'По этому запросу зарезервированных имён нет.'
              : 'Зарезервируйте первое имя выше — например, имя бренда или служебный аккаунт.'
          }
        />
      ) : (
        <>
          <div className={`glass-panel ${styles.tableWrap}`}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{'Имя'}</th>
                  <th>{'Комментарий'}</th>
                  <th>{'Добавил'}</th>
                  <th>{'Когда'}</th>
                  <th aria-label={'Действия'} />
                </tr>
              </thead>
              <tbody>
                {list.items.map((r) => (
                  <tr key={r.id}>
                    <td className={styles.name}>{r.username}</td>
                    <td className={styles.note}>{r.note || '—'}</td>
                    <td className={styles.who}>{r.created_by_username || '—'}</td>
                    <td className={styles.when}>{formatDate(r.created_at)}</td>
                    <td className={styles.actions}>
                      <button
                        type="button"
                        className={styles.iconBtnDanger}
                        disabled={busyId === r.id}
                        onClick={() => setToDelete(r)}
                        title={'Освободить имя'}
                        aria-label={`Освободить имя ${r.username}`}
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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

      <ConfirmDialog
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete) void remove(toDelete);
          setToDelete(null);
        }}
        title={'Освободить имя'}
        body={
          toDelete
            ? `Снять резерв с «${toDelete.username}»? Его сразу сможет занять любой желающий.`
            : ''
        }
        danger
      />
    </div>
  );
}

export default function ModUsernamesPage() {
  const h = splitHeading('Зарезервированные имена');
  return (
    <ModShell title={h.title} accent={h.accent} perm="usernames.manage">
      <UsernamesContent />
    </ModShell>
  );
}
