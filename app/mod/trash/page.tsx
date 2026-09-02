'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { RotateCcw, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { errMsg, useToast } from '@/lib/toast';
import { timeAgo } from '@/lib/format';
import type { Paginated, TrashEntry, TrashKind } from '@/lib/types';
import Spinner from '@/components/Spinner/Spinner';
import EmptyState from '@/components/EmptyState/EmptyState';
import Pagination from '@/components/Pagination/Pagination';
import Tabs from '@/components/Tabs/Tabs';
import ConfirmDialog from '@/components/ConfirmDialog/ConfirmDialog';
import { ModShell, ErrorPanel, splitHeading } from '@/app/mod/modnav';
import { TRASH_VIEW_PERMS } from '@/app/mod/navGroups';
import styles from './page.module.css';

const KIND_TABS: { key: TrashKind; label: string }[] = [
  { key: 'title', label: 'Тайтлы' },
  { key: 'narrator', label: 'Чтецы' },
  { key: 'chapter', label: 'Главы' },
  { key: 'author', label: 'Авторы' },
  { key: 'comment', label: 'Комментарии' },
];

function TrashContent() {
  const { can } = useAuth();
  const canRestore = can('trash.restore');
  const canPurge = can('trash.purge');
  const { toast } = useToast();

  const visibleTabs = KIND_TABS.filter((t) => can(`trash.view.${t.key}`));
  const [kind, setKind] = useState<TrashKind>(() => visibleTabs[0]?.key ?? 'title');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<TrashEntry> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [toPurge, setToPurge] = useState<TrashEntry | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api<Paginated<TrashEntry>>('/mod/trash', { params: { kind, page } })
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
  }, [kind, page, reload]);

  const drop = (id: number) =>
    setData((prev) =>
      prev
        ? { ...prev, items: prev.items.filter((x) => x.id !== id), total: Math.max(0, prev.total - 1) }
        : prev
    );

  const restore = async (e: TrashEntry) => {
    setBusyId(e.id);
    try {
      await api(`/mod/trash/${e.kind}/${e.id}/restore`, { method: 'POST', body: {} });
      toast('Восстановлено');
      drop(e.id);
    } catch (err) {
      toast(errMsg(err), 'error');
    }
    setBusyId(null);
  };

  const purge = async (e: TrashEntry) => {
    setBusyId(e.id);
    try {
      await api(`/mod/trash/${e.kind}/${e.id}`, { method: 'DELETE' });
      toast('Удалено навсегда');
      setToPurge(null);
      drop(e.id);
    } catch (err) {
      toast(errMsg(err), 'error');
    }
    setBusyId(null);
  };

  return (
    <div>
      <p className={styles.hint}>
        Ничто на сайте не удаляется сразу — всё попадает сюда. Модератор может вернуть запись,
        администратор — стереть её окончательно вместе с файлами.
      </p>

      <Tabs
        variant="underline"
        tabs={visibleTabs}
        active={kind}
        onChange={(k) => {
          setKind(k as TrashKind);
          setPage(1);
        }}
      />

      {error ? (
        <ErrorPanel message={error} onRetry={() => setReload((n) => n + 1)} />
      ) : loading || !data ? (
        <div className={styles.loading}>
          <Spinner />
        </div>
      ) : data.items.length === 0 ? (
        <EmptyState icon={Trash2} title="Здесь пусто" body="Ничего удалённого этого типа нет." />
      ) : (
        <>
          <div className={`glass-panel ${styles.tableWrap}`}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Название</th>
                  <th>Где</th>
                  <th>Удалено</th>
                  <th aria-label="Действия" />
                </tr>
              </thead>
              <tbody>
                {data.items.map((e) => {
                  const busy = busyId === e.id;
                  return (
                    <tr key={`${e.kind}-${e.id}`}>
                      <td>
                        {e.link ? (
                          <Link href={e.link} className={styles.name}>
                            {e.name}
                          </Link>
                        ) : (
                          <span className={styles.name}>{e.name}</span>
                        )}
                      </td>
                      <td className={styles.context}>{e.context || '—'}</td>
                      <td className={styles.when}>
                        {e.deleted_at ? timeAgo(e.deleted_at) : '—'}
                      </td>
                      <td>
                        <div className={styles.rowActions}>
                          {canRestore ? (
                            <button
                              type="button"
                              className={`btn ${styles.smallBtn}`}
                              disabled={busy}
                              onClick={() => void restore(e)}
                            >
                              <RotateCcw size={14} />
                              Вернуть
                            </button>
                          ) : null}
                          {canPurge ? (
                            <button
                              type="button"
                              className={`btn btn-danger ${styles.smallBtn}`}
                              disabled={busy}
                              onClick={() => setToPurge(e)}
                            >
                              <Trash2 size={14} />
                              Стереть
                            </button>
                          ) : null}
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
        open={!!toPurge}
        onClose={() => setToPurge(null)}
        onConfirm={() => {
          if (toPurge) void purge(toPurge);
        }}
        title="Стереть навсегда"
        body={
          toPurge
            ? `«${toPurge.name}» и все связанные файлы будут удалены окончательно. Вернуть будет нечего.`
            : ''
        }
        danger
      />
    </div>
  );
}

export default function ModTrashPage() {
  const h = splitHeading('Корзина модерации');
  return (
    <ModShell title={h.title} accent={h.accent} anyPerm={TRASH_VIEW_PERMS}>
      <TrashContent />
    </ModShell>
  );
}
