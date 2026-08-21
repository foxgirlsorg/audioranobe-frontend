'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ListChecks, Loader2, RotateCcw } from 'lucide-react';
import { api } from '@/lib/api';
import { errMsg, useToast } from '@/lib/toast';
import type { JobStatus, NarrationJob, NarrationJobList } from '@/lib/types';
import { ModShell, ErrorPanel } from '../modnav';
import StatusBadge from '@/components/StatusBadge/StatusBadge';
import Pagination from '@/components/Pagination/Pagination';
import Spinner from '@/components/Spinner/Spinner';
import EmptyState from '@/components/EmptyState/EmptyState';
import Tabs from '@/components/Tabs/Tabs';
import styles from './page.module.css';

const FILTERS: { key: '' | JobStatus; label: string }[] = [
  { key: 'error', label: 'С ошибкой' },
  { key: 'queued', label: 'В очереди' },
  { key: 'processing', label: 'В работе' },
  { key: 'done', label: 'Готово' },
  { key: '', label: 'Все' },
];

export default function TasksPage() {
  return (
    <ModShell title="Задачи озвучки" accent="">
      <TasksInner />
    </ModShell>
  );
}

function TasksInner() {
  const { toast } = useToast();
  const [status, setStatus] = useState<'' | JobStatus>('error');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<NarrationJobList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState<number | null>(null);
  const [nonce, setNonce] = useState(0);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    let alive = true;
    api<NarrationJobList>('/mod/narration-jobs', { params: { status: status || undefined, page } })
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(errMsg(e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [status, page, nonce]);

  useEffect(() => load(), [load]);

  const retry = async (job: NarrationJob) => {
    if (retrying) return;
    setRetrying(job.id);
    try {
      await api(`/mod/narration-jobs/${job.id}/retry`, { method: 'POST' });
      toast('Задача перезапущена', 'ok');
      setNonce((n) => n + 1);
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setRetrying(null);
    }
  };

  const counts = data?.counts;
  const tabs = FILTERS.map((f) => ({
    key: f.key || 'all',
    label: f.label,
    count: f.key && counts ? counts[f.key] : undefined,
  }));

  return (
    <div className={styles.wrap}>
      <Tabs
        variant="underline"
        tabs={tabs}
        active={status || 'all'}
        onChange={(k) => {
          setStatus(k === 'all' ? '' : (k as JobStatus));
          setPage(1);
        }}
      />

      {loading && !data ? (
        <div className={styles.center}>
          <Spinner />
        </div>
      ) : error ? (
        <ErrorPanel message={error} onRetry={() => setNonce((n) => n + 1)} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState icon={ListChecks} title="Задач нет" body="Здесь появятся задачи озвучки." />
      ) : (
        <>
          <div className={styles.list}>
            {data.items.map((job) => (
              <div key={job.id} className={`glass-panel ${styles.row}`}>
                <div className={styles.rowMain}>
                  <Link href={`/title/${job.title.slug}`} className={styles.jobTitle}>
                    {job.title.name}
                  </Link>
                  <span className={styles.jobMeta}>
                    Том {job.volume || '—'} · Глава {job.number}
                    {job.name ? ` · ${job.name}` : ''}
                  </span>
                  {job.error ? <span className={styles.jobError} title={job.error}>{job.error}</span> : null}
                </div>
                <div className={styles.rowSide}>
                  {job.attempts > 0 ? <span className={styles.attempts}>попыток: {job.attempts}</span> : null}
                  <StatusBadge status={job.status} />
                  {job.status === 'error' ? (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => retry(job)}
                      disabled={retrying === job.id}
                    >
                      {retrying === job.id ? <Loader2 size={14} className={styles.spin} /> : <RotateCcw size={14} />}
                      Перезапустить
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
          <div className={styles.pager}>
            <Pagination page={data.page} total={data.total} perPage={data.per_page} onPage={setPage} />
          </div>
        </>
      )}
    </div>
  );
}
