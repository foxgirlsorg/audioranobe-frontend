'use client';

import { useEffect, useState } from 'react';
import { ExternalLink, Shield } from 'lucide-react';
import { api } from '@/lib/api';
import { errMsg, useToast } from '@/lib/toast';
import { timeAgo } from '@/lib/format';
import type { DmcaRequest, Paginated } from '@/lib/types';
import Spinner from '@/components/Spinner/Spinner';
import EmptyState from '@/components/EmptyState/EmptyState';
import Tabs from '@/components/Tabs/Tabs';
import Pagination from '@/components/Pagination/Pagination';
import { ModShell, ErrorPanel, splitHeading } from '@/app/mod/modnav';
import styles from './page.module.css';

const STATUS_TABS = [
  { key: 'open', label: 'Ожидающие' },
  { key: 'resolved', label: 'Решённые' },
];

function UrlList({ label, urls }: { label: string; urls: string[] }) {
  const clean = urls.filter(Boolean);
  if (clean.length === 0) return null;
  return (
    <div className={styles.description}>
      <span className={styles.fieldLabel}>{label}</span>
      <ul className={styles.linkList}>
        {clean.map((u) => (
          <li key={u}>
            <a href={u} target="_blank" rel="noopener noreferrer" className={styles.link}>
              {u} <ExternalLink size={12} />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DmcaContent() {
  const { toast } = useToast();
  const [tab, setTab] = useState('open');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<DmcaRequest> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api<Paginated<DmcaRequest>>('/mod/dmca', { params: { status: tab, page } })
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

  const resolve = async (r: DmcaRequest, status: 'resolved' | 'dismissed') => {
    setBusyId(r.id);
    try {
      await api(`/mod/dmca/${r.id}/resolve`, { method: 'POST', body: { status } });
      toast(status === 'resolved' ? 'Заявка DMCA решена' : 'Заявка DMCA отклонена');
      setData((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.filter((x) => x.id !== r.id),
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
      <Tabs
        variant="underline"
        tabs={STATUS_TABS}
        active={tab}
        onChange={(k) => {
          setTab(k);
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
          icon={Shield}
          title={tab === 'open' ? 'Нет ожидающих заявок' : 'Нет решённых заявок'}
          body={tab === 'open' ? 'Все заявки DMCA обработаны.' : undefined}
        />
      ) : (
        <>
          <div className={styles.list}>
            {data.items.map((r) => {
              const busy = busyId === r.id;
              return (
                <article key={r.id} className={`glass-panel ${styles.card}`}>
                  <header className={styles.cardHead}>
                    <span className={styles.titleName}>{r.name}</span>
                    <span className={styles.meta}>
                      {timeAgo(r.created_at)}
                    </span>
                  </header>

                  <div className={styles.fields}>
                    <div className={styles.field}>
                      <span className={styles.fieldLabel}>{'Email'}</span>
                      <span className={styles.fieldValue}>{r.email}</span>
                    </div>
                    <div className={styles.field}>
                      <span className={styles.fieldLabel}>{'Страна'}</span>
                      <span className={styles.fieldValue}>{r.country || '—'}</span>
                    </div>
                  </div>

                  <UrlList
                    label={'Материалы к удалению'}
                    urls={r.content_urls.length ? r.content_urls : [r.content_url]}
                  />
                  <UrlList label={'Оригинальное размещение'} urls={r.original_urls} />

                  <div className={styles.description}>
                    <span className={styles.fieldLabel}>{'Подтверждение авторства'}</span>
                    <p className={styles.descText}>{r.proof_url || '—'}</p>
                  </div>

                  {r.description ? (
                    <div className={styles.description}>
                      <span className={styles.fieldLabel}>{'Описание'}</span>
                      <p className={styles.descText}>{r.description}</p>
                    </div>
                  ) : null}

                  {r.resolution_note ? (
                    <div className={styles.description}>
                      <span className={styles.fieldLabel}>{'Примечание модератора'}</span>
                      <p className={styles.descText}>{r.resolution_note}</p>
                    </div>
                  ) : null}

                  {tab === 'open' ? (
                    <div className={styles.actions}>
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={busy}
                        onClick={() => resolve(r, 'resolved')}
                      >
                        {'Удовлетворить'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        disabled={busy}
                        onClick={() => resolve(r, 'dismissed')}
                      >
                        {'Отклонить'}
                      </button>
                    </div>
                  ) : r.resolved_at ? (
                    <div className={styles.resolvedAt}>
                      {'Решено'} {timeAgo(r.resolved_at)}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
          <Pagination
            page={data.page}
            total={data.total}
            perPage={data.per_page}
            onPage={setPage}
          />
        </>
      )}
    </div>
  );
}

export default function ModDmcaPage() {
  const h = splitHeading('Заявки DMCA');
  return (
    <ModShell title={h.title} accent={h.accent} adminOnly>
      <DmcaContent />
    </ModShell>
  );
}
