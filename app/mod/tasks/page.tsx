'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ListChecks, Loader2, RotateCcw, Undo2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { timeAgo } from '@/lib/format';
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
    <ModShell title="Задачи" accent="" perm="narration.jobs">
      <TasksInner />
    </ModShell>
  );
}

function TasksInner() {
  const { toast } = useToast();
  // Releasing a live claim is a node-operator action, not general job triage.
  const canRequeue = useAuth().can('nodes.manage');
  const [status, setStatus] = useState<'' | JobStatus>('error');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<NarrationJobList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);
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

  const run = async (job: NarrationJob, action: 'retry' | 'requeue') => {
    const key = `${job.kind}-${job.id}`;
    if (retrying) return;
    setRetrying(key);
    try {
      const base = job.kind === 'convert' ? '/mod/convert-jobs' : '/mod/narration-jobs';
      await api(`${base}/${job.id}/${action}`, { method: 'POST' });
      toast(action === 'requeue' ? 'Задача возвращена в очередь' : 'Задача перезапущена', 'ok');
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
        <EmptyState icon={ListChecks} title="Задач нет" body="Здесь появятся задачи." />
      ) : (
        <>
          <div className={styles.list}>
            {data.items.map((job) => (
              <div key={`${job.kind}-${job.id}`} className={`glass-panel ${styles.row}`}>
                <div className={styles.rowMain}>
                  <Link href={`/title/${job.title.slug}`} className={styles.jobTitle}>
                    {job.title.name}
                  </Link>
                  <span className={styles.jobMeta}>
                    <span className={`${styles.kindChip}${job.kind === 'convert' ? ` ${styles.kindConvert}` : ''}`}>
                      {job.kind === 'convert' ? 'Конвертация' : 'Озвучка'}
                    </span>
                    Том {job.volume || '—'} · Глава {job.number}
                    {job.name ? ` · ${job.name}` : ''}
                  </span>
                  {job.error ? <span className={styles.jobError} title={job.error}>{job.error}</span> : null}
                  {job.status === 'processing' && job.claimed_at ? (
                    <span className={styles.jobSince}>{`в работе ${timeAgo(job.claimed_at)}`}</span>
                  ) : null}
                </div>
                <div className={styles.rowSide}>
                  {job.attempts > 0 ? <span className={styles.attempts}>попыток: {job.attempts}</span> : null}
                  <StatusBadge status={job.status} />
                  {job.status === 'error' ? (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => run(job, 'retry')}
                      disabled={retrying === `${job.kind}-${job.id}`}
                    >
                      {retrying === `${job.kind}-${job.id}` ? <Loader2 size={14} className={styles.spin} /> : <RotateCcw size={14} />}
                      Перезапустить
                    </button>
                  ) : null}
                  {job.status === 'processing' && canRequeue ? (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => run(job, 'requeue')}
                      disabled={retrying === `${job.kind}-${job.id}`}
                      title="Снять задачу с ноды и вернуть её в очередь"
                    >
                      {retrying === `${job.kind}-${job.id}` ? <Loader2 size={14} className={styles.spin} /> : <Undo2 size={14} />}
                      Вернуть в очередь
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
