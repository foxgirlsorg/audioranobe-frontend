'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, Mic, Pencil, RotateCcw, Search, Trash2, X } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { errMsg, useToast } from '@/lib/toast';
import { timeAgo } from '@/lib/format';
import type { ModNarrator, ModNarratorList } from '@/lib/types';
import Spinner from '@/components/Spinner/Spinner';
import EmptyState from '@/components/EmptyState/EmptyState';
import Pagination from '@/components/Pagination/Pagination';
import Tabs from '@/components/Tabs/Tabs';
import StatusBadge from '@/components/StatusBadge/StatusBadge';
import ConfirmDialog from '@/components/ConfirmDialog/ConfirmDialog';
import { ModShell, ErrorPanel, splitHeading } from '@/app/mod/modnav';
import styles from './page.module.css';

type Status = 'all' | 'pending' | 'approved' | 'rejected' | 'deleted';

function NarratorsContent() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { toast } = useToast();

  const [status, setStatus] = useState<Status>('pending');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ModNarratorList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [toDelete, setToDelete] = useState<ModNarrator | null>(null);
  const [toPurge, setToPurge] = useState<ModNarrator | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(q.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api<ModNarratorList>('/mod/narrators', { params: { status, q: query, page, per_page: 50 } })
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
  }, [status, query, page, reload]);

  const act = async (n: ModNarrator, run: () => Promise<unknown>, done: string) => {
    setBusyId(n.id);
    try {
      await run();
      toast(done);
      setToDelete(null);
      setToPurge(null);
      setReload((x) => x + 1);
    } catch (e) {
      toast(errMsg(e), 'error');
    }
    setBusyId(null);
  };

  const setModStatus = (n: ModNarrator, next: 'approved' | 'rejected') =>
    act(
      n,
      () => api(`/mod/narrators/${n.id}`, { method: 'PATCH', body: { mod_status: next } }),
      next === 'approved' ? 'Чтец одобрен' : 'Чтец отклонён'
    );

  const TABS: { key: Status; label: string; count?: number }[] = [
    { key: 'pending', label: 'На проверке', count: data?.counts.pending },
    { key: 'approved', label: 'Одобренные', count: data?.counts.approved },
    { key: 'rejected', label: 'Отклонённые', count: data?.counts.rejected },
    { key: 'deleted', label: 'В корзине', count: data?.counts.deleted },
    { key: 'all', label: 'Все' },
  ];

  return (
    <div>
      <p className={styles.hint}>
        Все страницы чтецов — включая ожидающие проверки, отклонённые и удалённые. Публичный
        каталог показывает только одобренных.
      </p>

      <Tabs
        variant="pill"
        tabs={TABS}
        active={status}
        onChange={(k) => {
          setStatus(k as Status);
          setPage(1);
        }}
      />

      <div className={styles.searchRow}>
        <Search size={16} className={styles.searchIcon} aria-hidden="true" />
        <input
          className={`input ${styles.searchInput}`}
          type="search"
          placeholder={'Поиск по имени или slug…'}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label={'Поиск чтецов'}
        />
      </div>

      {error ? (
        <ErrorPanel message={error} onRetry={() => setReload((n) => n + 1)} />
      ) : loading || !data ? (
        <div className={styles.loading}>
          <Spinner />
        </div>
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={Mic}
          title={'Чтецов нет'}
          body={'В этой категории пока никого.'}
        />
      ) : (
        <>
          <div className={`glass-panel ${styles.tableWrap}`}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{'Чтец'}</th>
                  <th>{'Владелец'}</th>
                  <th>{'Тайтлов'}</th>
                  <th>{'Подписчиков'}</th>
                  <th>{'Статус'}</th>
                  <th>{'Создан'}</th>
                  <th aria-label={'Действия'} />
                </tr>
              </thead>
              <tbody>
                {data.items.map((n) => {
                  const busy = busyId === n.id;
                  const deleted = n.deleted_at !== null;
                  return (
                    <tr key={n.id}>
                      <td>
                        <Link href={`/narrator/${encodeURIComponent(n.slug)}`} className={styles.name}>
                          {n.name}
                        </Link>
                        <span className={styles.slug}>{n.slug}</span>
                        {n.is_self ? <span className={styles.selfTag}>{'сам чтец'}</span> : null}
                        {isAdmin && n.admin_contact ? (
                          <span className={styles.contact} title={'Контакт для админов'}>
                            {n.admin_contact}
                          </span>
                        ) : null}
                      </td>
                      <td className={styles.muted}>
                        {n.owner ? (
                          <Link href={`/user/${n.owner.id}`} className={styles.owner}>
                            {n.owner.username}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className={styles.muted}>{n.titles_count}</td>
                      <td className={styles.muted}>{n.subscribers_count}</td>
                      <td>
                        <span className={styles.badges}>
                          <StatusBadge status={n.mod_status} />
                          {deleted ? <span className={styles.deletedTag}>{'удалён'}</span> : null}
                        </span>
                      </td>
                      <td className={styles.muted}>{timeAgo(n.created_at)}</td>
                      <td>
                        <div className={styles.rowActions}>
                          {deleted ? (
                            <>
                              {isAdmin ? (
                              <button
                                type="button"
                                className={`btn ${styles.smallBtn}`}
                                disabled={busy}
                                onClick={() =>
                                  void act(
                                    n,
                                    () =>
                                      api(`/mod/trash/narrator/${n.id}/restore`, {
                                        method: 'POST',
                                        body: {},
                                      }),
                                    'Чтец восстановлен'
                                  )
                                }
                              >
                                <RotateCcw size={14} />
                                {'Вернуть'}
                              </button>
                              ) : null}
                              {isAdmin ? (
                                <button
                                  type="button"
                                  className={`btn btn-danger ${styles.smallBtn}`}
                                  disabled={busy}
                                  onClick={() => setToPurge(n)}
                                >
                                  <Trash2 size={14} />
                                  {'Стереть'}
                                </button>
                              ) : null}
                            </>
                          ) : (
                            <>
                              {n.mod_status !== 'approved' ? (
                                <button
                                  type="button"
                                  className={`btn btn-primary ${styles.smallBtn}`}
                                  disabled={busy}
                                  onClick={() => void setModStatus(n, 'approved')}
                                  title={'Одобрить'}
                                >
                                  <Check size={14} />
                                  {'Одобрить'}
                                </button>
                              ) : null}
                              {n.mod_status !== 'rejected' ? (
                                <button
                                  type="button"
                                  className={`btn ${styles.smallBtn}`}
                                  disabled={busy}
                                  onClick={() => void setModStatus(n, 'rejected')}
                                  title={'Отклонить'}
                                >
                                  <X size={14} />
                                  {'Отклонить'}
                                </button>
                              ) : null}
                              <Link
                                href={`/narrator/${encodeURIComponent(n.slug)}/edit`}
                                className={`btn btn-ghost ${styles.smallBtn}`}
                                title={'Редактировать'}
                              >
                                <Pencil size={14} />
                              </Link>
                              <button
                                type="button"
                                className={`btn btn-ghost ${styles.smallBtn}`}
                                disabled={busy}
                                onClick={() => setToDelete(n)}
                                title={'Удалить'}
                              >
                                <Trash2 size={14} />
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
          <Pagination
            page={data.page}
            total={data.total}
            perPage={data.per_page}
            onPage={setPage}
          />
        </>
      )}

      <ConfirmDialog
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete)
            void act(
              toDelete,
              () => api(`/mod/narrators/${toDelete.id}`, { method: 'DELETE' }),
              'Чтец удалён'
            );
        }}
        title={'Удалить чтеца'}
        body={
          toDelete
            ? `«${toDelete.name}» попадёт в корзину. Тайтлы этого чтеца останутся на месте.`
            : ''
        }
        danger
      />

      <ConfirmDialog
        open={toPurge !== null}
        onClose={() => setToPurge(null)}
        onConfirm={() => {
          if (toPurge)
            void act(
              toPurge,
              () => api(`/mod/trash/narrator/${toPurge.id}`, { method: 'DELETE' }),
              'Удалено навсегда'
            );
        }}
        title={'Стереть навсегда'}
        body={
          toPurge
            ? `«${toPurge.name}», аватар и обложка будут удалены окончательно. Вернуть будет нечего.`
            : ''
        }
        danger
      />
    </div>
  );
}

export default function ModNarratorsPage() {
  const h = splitHeading('Управление чтецами');
  return (
    <ModShell title={h.title} accent={h.accent}>
      <NarratorsContent />
    </ModShell>
  );
}
