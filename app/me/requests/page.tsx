'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ClipboardList, RotateCcw } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { errMsg, useToast } from '@/lib/toast';
import type { ModRequest, Paginated } from '@/lib/types';
import Spinner from '@/components/Spinner/Spinner';
import EmptyState from '@/components/EmptyState/EmptyState';
import StatusBadge from '@/components/StatusBadge/StatusBadge';
import Pagination from '@/components/Pagination/Pagination';
import { formatDateTime, timeAgo } from '@/lib/format';
import styles from './requests.module.css';

const ENTITY_LABELS: Record<ModRequest['entity_type'], string> = {
  narrator: 'чтец',
  title: 'тайтл',
  chapter: 'глава',
  author: 'автор',
};

const ACTION_LABELS: Record<ModRequest['action'], string> = {
  create: 'создание',
  update: 'изменение',
  delete: 'удаление',
  transfer: 'передача',
};

const FIELD_LABELS: Record<string, string> = {
  name: 'название',
  bio: 'описание',
  socials: 'соцсети',
  alt_names: 'альтернативные названия',
  author: 'автор',
  description: 'описание',
  year: 'год',
  release_status: 'статус выхода',
  genre_ids: 'теги',
  narrator_id: 'ID чтеца',
  volume_id: 'ID тома',
  number: 'номер',
};

function fmtValue(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'string') return v || '—';
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) {
    const joined = v
      .map((x) => (x !== null && typeof x === 'object' ? JSON.stringify(x) : String(x)))
      .join(', ');
    return joined || '—';
  }
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function truncate(s: string, n = 140): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

function entityName(r: ModRequest): string | null {
  if (r.entity && typeof r.entity.name === 'string' && r.entity.name) return r.entity.name;
  return null;
}

export default function PanelRequestsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [data, setData] = useState<Paginated<ModRequest> | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [retryingId, setRetryingId] = useState<number | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace(`/auth/login?next=${encodeURIComponent('/me/requests')}`);
    }
  }, [authLoading, user, router]);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try {
      setLoadError('');
      const res = await api<Paginated<ModRequest>>('/panel/requests', { params: { page: p } });
      setData(res);
    } catch (e) {
      setLoadError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) void load(page);
  }, [user, page, load]);

  async function retryRequest(id: number) {
    setRetryingId(id);
    try {
      const updated = await api<ModRequest>(`/panel/requests/${id}/retry`, { method: 'POST', body: {} });
      setData((prev) =>
        prev
          ? { ...prev, items: prev.items.map((r) => (r.id === id ? updated : r)) }
          : prev
      );
      toast('Заявка отправлена повторно');
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setRetryingId(null);
    }
  }

  if (authLoading || !user) {
    return (
      <div className={styles.center}>
        <Spinner />
      </div>
    );
  }

  return (
    <div>
      <header className={styles.head}>
        <div>
          <span className="eyebrow">История модерации</span>
          <h1 className={styles.heading}>
            Мои <span className={styles.headingAccent}>заявки</span>
          </h1>
        </div>
        <Link href="/" className="btn btn-ghost">
          <ArrowLeft size={15} />
          На главную
        </Link>
      </header>

      {loading && !data ? (
        <div className={styles.center}>
          <Spinner />
        </div>
      ) : loadError ? (
        <EmptyState icon={ClipboardList} title="Не удалось загрузить заявки" body={loadError} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Пока нет заявок"
          body="Когда вы создаёте или редактируете чтецов, тайтлы и главы, ваши заявки на модерацию появляются здесь."
        />
      ) : (
        <>
          <div className={styles.list}>
            {data.items.map((r) => {
              const name = entityName(r);
              const payloadEntries = Object.entries(r.payload ?? {});
              return (
                <article key={r.id} className={`glass-panel ${styles.card}`}>
                  <div className={styles.cardHead}>
                    <div className={styles.cardHeadLeft}>
                      <span className={styles.typeBadge}>{ENTITY_LABELS[r.entity_type]}</span>
                      <span className="badge">{ACTION_LABELS[r.action]}</span>
                      {name ? <span className={styles.entityName}>{name}</span> : null}
                      {!name && r.entity_id != null ? (
                        <span className={styles.entityId}>#{r.entity_id}</span>
                      ) : null}
                    </div>
                    <StatusBadge status={r.status} />
                  </div>

                  {payloadEntries.length > 0 ? (
                    <dl className={styles.payload}>
                      {payloadEntries.map(([k, v]) => (
                        <React.Fragment key={k}>
                          <dt className={styles.pKey}>
                            {FIELD_LABELS[k] ?? k.replace(/_/g, ' ')}
                          </dt>
                          <dd className={styles.pVal}>{truncate(fmtValue(v))}</dd>
                        </React.Fragment>
                      ))}
                    </dl>
                  ) : (
                    <p className={styles.noPayload}>Изменений полей нет.</p>
                  )}

                  {r.review_note ? (
                    <div className={styles.note}>
                      <span className={styles.noteLabel}>
                        {r.status === 'rejected' ? 'Причина отклонения' : 'Комментарий модератора'}
                      </span>
                      {r.review_note}
                    </div>
                  ) : null}

                  {r.status === 'rejected' && r.can_retry ? (
                    <div className={styles.retryRow}>
                      <button
                        type="button"
                        className="btn"
                        disabled={retryingId === r.id}
                        onClick={() => retryRequest(r.id)}
                      >
                        <RotateCcw size={13} />
                        {retryingId === r.id ? 'Отправляем…' : 'Отправить повторно'}
                      </button>
                      {r.retry_count > 0 ? (
                        <span className={styles.retryCount}>
                          {`Попытка ${r.retry_count} из 3`}
                        </span>
                      ) : null}
                    </div>
                  ) : null}

                  {r.status === 'rejected' && !r.can_retry && r.retry_count >= 3 ? (
                    <div className={styles.retryRow}>
                      <span className={styles.retryCount}>
                        {`Исчерпано попыток (${r.retry_count}/3)`}
                      </span>
                    </div>
                  ) : null}

                  <footer className={styles.meta}>
                    <span title={formatDateTime(r.created_at)}>
                      {`Отправлено ${timeAgo(r.created_at)}`}
                    </span>
                    {r.reviewed_at ? (
                      <span title={formatDateTime(r.reviewed_at)}>
                        {`Рассмотрено ${timeAgo(r.reviewed_at)}`}
                      </span>
                    ) : (
                      <span>Ожидает рассмотрения</span>
                    )}
                  </footer>
                </article>
              );
            })}
          </div>
          <Pagination
            page={data.page}
            total={data.total}
            perPage={data.per_page}
            onPage={(p) => setPage(p)}
          />
        </>
      )}
    </div>
  );
}
