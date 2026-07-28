'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ScrollText } from 'lucide-react';
import { api } from '@/lib/api';
import { errMsg } from '@/lib/toast';
import { formatDateTime } from '@/lib/format';
import type { AuditEntry, Paginated } from '@/lib/types';
import Spinner from '@/components/Spinner';
import EmptyState from '@/components/EmptyState';
import Pagination from '@/components/Pagination';
import { ModShell, ErrorPanel, splitHeading } from '@/app/mod/modnav';
import styles from './page.module.css';

function AuditContent() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<AuditEntry> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api<Paginated<AuditEntry>>('/mod/audit', { params: { page } })
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

  if (error) return <ErrorPanel message={error} onRetry={() => setReload((n) => n + 1)} />;

  if (loading || !data) {
    return (
      <div className={styles.loading}>
        <Spinner />
      </div>
    );
  }

  if (data.items.length === 0) {
    return (
      <EmptyState
        icon={ScrollText}
        title={'Пока ничего не записано'}
        body={'Действия модераторов будут появляться здесь.'}
      />
    );
  }

  return (
    <>
      <div className={`glass-panel ${styles.tableWrap}`}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{'Время'}</th>
              <th>{'Модератор'}</th>
              <th>{'Действие'}</th>
              <th>{'Объект'}</th>
              <th>{'Детали'}</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((en) => {
              const details = en.details || {};
              const hasDetails = Object.keys(details).length > 0;
              return (
                <tr key={en.id}>
                  <td className={styles.time}>{formatDateTime(en.created_at)}</td>
                  <td>
                    {en.actor ? (
                      <Link
                        href={`/user/${en.actor.id}`}
                        className={styles.actor}
                      >
                        {en.actor.username}
                      </Link>
                    ) : (
                      <span className={styles.deleted}>{'удалён'}</span>
                    )}
                  </td>
                  <td>
                    <span className={styles.action}>{en.action}</span>
                  </td>
                  <td className={styles.entity}>
                    {en.entity_type
                      ? `${en.entity_type}${en.entity_id != null ? ` #${en.entity_id}` : ''}`
                      : '—'}
                  </td>
                  <td className={styles.details}>
                    {hasDetails ? <code>{JSON.stringify(details)}</code> : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Pagination page={data.page} total={data.total} perPage={data.per_page} onPage={setPage} />
    </>
  );
}

export default function ModAuditPage() {
  const h = splitHeading('Аудит действий');
  return (
    <ModShell title={h.title} accent={h.accent} adminOnly>
      <AuditContent />
    </ModShell>
  );
}
