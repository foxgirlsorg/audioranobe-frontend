'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Flag } from 'lucide-react';
import { api } from '@/lib/api';
import { errMsg, useToast } from '@/lib/toast';
import { timeAgo } from '@/lib/format';
import type { Paginated, Report } from '@/lib/types';
import Spinner from '@/components/Spinner/Spinner';
import EmptyState from '@/components/EmptyState/EmptyState';
import Tabs from '@/components/Tabs/Tabs';
import Pagination from '@/components/Pagination/Pagination';
import Modal from '@/components/Modal/Modal';
import StatusBadge from '@/components/StatusBadge/StatusBadge';
import { ModShell, ErrorPanel, splitHeading } from '@/app/mod/modnav';
import styles from './page.module.css';

type ReportTab = 'open' | 'resolved' | 'dismissed';

const STATUS_TABS = [
  { key: 'open', label: 'Открытые' },
  { key: 'resolved', label: 'Решённые' },
  { key: 'dismissed', label: 'Отклонённые' },
];

const EMPTY_TITLES: Record<ReportTab, string> = {
  open: 'Открытых жалоб нет',
  resolved: 'Решённых жалоб нет',
  dismissed: 'Отклонённых жалоб нет',
};

const TARGET_LABELS: Record<string, string> = {
  comment: 'комментарий',
  title: 'тайтл',
  narrator: 'чтец',
  chapter: 'глава',
  user: 'пользователь',
  collection: 'коллекция',
};

function ReportsContent() {
  const { toast } = useToast();
  const [tab, setTab] = useState<ReportTab>('open');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<Report> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  const [action, setAction] = useState<{
    report: Report;
    status: 'resolved' | 'dismissed';
  } | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api<Paginated<Report>>('/mod/reports', { params: { status: tab, page } })
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
  }, [tab, page, reload]);

  const openAction = (report: Report, status: 'resolved' | 'dismissed') => {
    setNote('');
    setAction({ report, status });
  };

  const closeAction = () => {
    if (!busy) setAction(null);
  };

  const submitAction = async () => {
    if (!action) return;
    setBusy(true);
    try {
      await api(`/mod/reports/${action.report.id}/resolve`, {
        method: 'POST',
        body: { status: action.status, note: note.trim() },
      });
      toast(action.status === 'resolved' ? 'Жалоба принята' : 'Жалоба отклонена');
      setData((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.filter((r) => r.id !== action.report.id),
              total: Math.max(0, prev.total - 1),
            }
          : prev
      );
      setAction(null);
    } catch (e) {
      toast(errMsg(e), 'error');
    }
    setBusy(false);
  };

  return (
    <div>
      <Tabs
        tabs={STATUS_TABS}
        active={tab}
        onChange={(k) => {
          setTab(k as ReportTab);
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
        <EmptyState
          icon={Flag}
          title={EMPTY_TITLES[tab]}
          body={tab === 'open' ? 'Сообщество ведёт себя прилично. Пока что.' : undefined}
        />
      ) : (
        <>
          <div className={styles.list}>
            {data.items.map((r) => (
              <article key={r.id} className={`glass-panel ${styles.row}`}>
                <header className={styles.rowHead}>
                  {r.reporter ? (
                    <Link
                      href={`/user/${r.reporter.id}`}
                      className={styles.reporter}
                    >
                      {r.reporter.username}
                    </Link>
                  ) : (
                    <span className={styles.deleted}>{'удалённый пользователь'}</span>
                  )}
                  <span className={styles.flagWord}>{'— жалоба:'}</span>
                  <span className="badge">
                    {TARGET_LABELS[r.target_type]
                      ? TARGET_LABELS[r.target_type]
                      : r.target_type}
                  </span>
                  <span className={styles.time}>{timeAgo(r.created_at)}</span>
                </header>

                <div className={styles.target}>
                  <span className={styles.preview}>{r.target_preview || '—'}</span>
                  {r.target_link ? (
                    <Link href={r.target_link} className={styles.targetLink}>
                      {'Открыть'} <ArrowUpRight size={13} />
                    </Link>
                  ) : (
                    <span className={styles.gone}>{'объект удалён'}</span>
                  )}
                </div>

                <blockquote className={styles.reason}>{r.reason}</blockquote>

                {r.status === 'open' ? (
                  <div className={styles.actions}>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => openAction(r, 'resolved')}
                    >
                      {'Принять'}
                    </button>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => openAction(r, 'dismissed')}
                    >
                      {'Отклонить'}
                    </button>
                  </div>
                ) : (
                  <div className={styles.resolution}>
                    <StatusBadge status={r.status} />
                    {r.resolved_at ? (
                      <span className={styles.time}>{timeAgo(r.resolved_at)}</span>
                    ) : null}
                    {r.resolution_note ? (
                      <span className={styles.note}>&ldquo;{r.resolution_note}&rdquo;</span>
                    ) : null}
                  </div>
                )}
              </article>
            ))}
          </div>
          <Pagination
            page={data.page}
            total={data.total}
            perPage={data.per_page}
            onPage={setPage}
          />
        </>
      )}

      <Modal
        open={!!action}
        onClose={closeAction}
        title={action?.status === 'resolved' ? 'Принять жалобу' : 'Отклонить жалобу'}
      >
        <div className={styles.modalBody}>
          <span className={styles.modalLabel}>{'Заметка (необязательно)'}</span>
          <textarea
            className="textarea"
            rows={3}
            placeholder={'Почему такое решение…'}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className={styles.modalActions}>
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={closeAction}>
              {'Отмена'}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={submitAction}
            >
              {action?.status === 'resolved' ? 'Принять' : 'Отклонить'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default function ModReportsPage() {
  const h = splitHeading('Жалобы пользователей');
  return (
    <ModShell title={h.title} accent={h.accent}>
      <ReportsContent />
    </ModShell>
  );
}
