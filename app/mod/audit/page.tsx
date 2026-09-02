'use client';

import { useCallback } from 'react';
import Link from 'next/link';
import { ScrollText } from 'lucide-react';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { useInfiniteList } from '@/lib/useInfiniteList';
import type { AuditEntry, Paginated } from '@/lib/types';
import Spinner from '@/components/Spinner/Spinner';
import EmptyState from '@/components/EmptyState/EmptyState';
import InfiniteScroll from '@/components/InfiniteScroll/InfiniteScroll';
import { ModShell, ErrorPanel, splitHeading } from '@/app/mod/modnav';
import styles from './page.module.css';

function AuditContent() {
  const fetchPage = useCallback(
    (page: number) => api<Paginated<AuditEntry>>('/mod/audit', { params: { page } }),
    []
  );
  const list = useInfiniteList<AuditEntry>(fetchPage);

  if (list.error) return <ErrorPanel message={list.error} onRetry={list.reload} />;

  if (list.loading || !list.items) {
    return (
      <div className={styles.loading}>
        <Spinner />
      </div>
    );
  }

  if (list.items.length === 0) {
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
            {list.items.map((en) => {
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
      <InfiniteScroll
        hasMore={list.hasMore}
        loading={list.loadingMore}
        error={list.moreError}
        onLoad={list.loadMore}
        total={list.total}
        shown={list.items.length}
      />
    </>
  );
}

export default function ModAuditPage() {
  const h = splitHeading('Аудит действий');
  return (
    <ModShell title={h.title} accent={h.accent} perm="audit.view">
      <AuditContent />
    </ModShell>
  );
}
