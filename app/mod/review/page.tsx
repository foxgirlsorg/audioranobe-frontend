'use client';

import { useEffect, useState } from 'react';
import { ShieldCheck, Check, Eye } from 'lucide-react';
import { api } from '@/lib/api';
import { errMsg, useToast } from '@/lib/toast';
import type { Paginated, ReviewQueueItem } from '@/lib/types';
import Spinner from '@/components/Spinner/Spinner';
import EmptyState from '@/components/EmptyState/EmptyState';
import Pagination from '@/components/Pagination/Pagination';
import TitleReviewModal from '@/components/TitleReviewModal/TitleReviewModal';
import { ModShell, ErrorPanel, splitHeading } from '@/app/mod/modnav';
import styles from './page.module.css';

function ReviewQueueContent() {
  const { toast } = useToast();

  const [data, setData] = useState<Paginated<ReviewQueueItem> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [openSlug, setOpenSlug] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api<Paginated<ReviewQueueItem>>('/mod/review-queue', { params: { page, per_page: 30 } })
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

  const removeFromList = (id: number) => {
    setData((prev) =>
      prev ? { ...prev, items: prev.items.filter((x) => x.id !== id), total: Math.max(0, prev.total - 1) } : prev
    );
  };

  const check = async (item: ReviewQueueItem) => {
    setBusyId(item.id);
    try {
      await api(`/mod/titles/${item.id}/review-check`, { method: 'POST' });
      toast(`«${item.name}» отмечен проверенным`);
      removeFromList(item.id);
    } catch (e) {
      toast(errMsg(e), 'error');
    }
    setBusyId(null);
  };

  if (error) {
    return <ErrorPanel message={error} onRetry={() => setReload((n) => n + 1)} />;
  }
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
        icon={ShieldCheck}
        title={'Нечего проверять'}
        body={'Все тайтлы, опубликованные напрямую (импорт или разрешение публиковать без модерации), уже проверены.'}
      />
    );
  }

  return (
    <>
      <p className={styles.hint}>
        {
          'Тайтлы, опубликованные в обход обычной очереди — импортированные или созданные пользователями с разрешением публиковать без модерации. Отметьте, что посмотрели на тайтл, чтобы убрать его из списка.'
        }
      </p>
      <div className={`glass-panel ${styles.tableWrap}`}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{'Тайтл'}</th>
              <th>{'Источник'}</th>
              <th>{'Автор'}</th>
              <th>{'Создан'}</th>
              <th aria-label={'Действия'} />
            </tr>
          </thead>
          <tbody>
            {data.items.map((item) => {
              const busy = busyId === item.id;
              return (
                <tr key={item.id}>
                  <td>
                    <button
                      type="button"
                      className={styles.titleLink}
                      onClick={() => setOpenSlug(item.slug)}
                    >
                      {item.name}
                    </button>
                  </td>
                  <td className={styles.note}>
                    {item.is_imported ? (
                      <span className={styles.badgeImport}>{'импорт'}</span>
                    ) : item.created_by_skips_moderation ? (
                      <span className={styles.badgeSkip}>{'без модерации'}</span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className={styles.note}>{item.created_by ?? '—'}</td>
                  <td className={styles.note}>{new Date(item.created_at).toLocaleString('ru-RU')}</td>
                  <td>
                    <div className={styles.rowActions}>
                      <button
                        type="button"
                        className={`btn btn-ghost ${styles.smallBtn}`}
                        onClick={() => setOpenSlug(item.slug)}
                        title={'Открыть тайтл'}
                      >
                        <Eye size={14} /> {'Открыть'}
                      </button>
                      <button
                        type="button"
                        className={`btn btn-primary ${styles.smallBtn}`}
                        disabled={busy}
                        onClick={() => void check(item)}
                        title={'Отметить проверенным'}
                      >
                        <Check size={14} /> {'Проверено'}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Pagination page={data.page} total={data.total} perPage={data.per_page} onPage={setPage} />
      <TitleReviewModal slug={openSlug} onClose={() => setOpenSlug(null)} />
    </>
  );
}

export default function ModReviewPage() {
  const h = splitHeading('Проверка тайтлов');
  return (
    <ModShell title={h.title} accent={h.accent} perm="content.review">
      <ReviewQueueContent />
    </ModShell>
  );
}
