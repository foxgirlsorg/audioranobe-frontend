'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Library } from 'lucide-react';
import { api } from '@/lib/api';
import {
  LIBRARY_STATUS_LABELS,
  LIBRARY_STATUS_VALUES,
  type LibraryEntry,
  type Paginated,
} from '@/lib/types';
import { useAuth } from '@/lib/auth';
import { useToast, errMsg } from '@/lib/toast';
import { timeAgo } from '@/lib/format';
import Spinner from '@/components/Spinner';
import EmptyState from '@/components/EmptyState';
import Tabs from '@/components/Tabs';
import Pagination from '@/components/Pagination';
import TitleCardC from '@/components/TitleCardC';
import LibraryWidget from '@/components/LibraryWidget';
import styles from './page.module.css';

const PER_PAGE = 12;

const TABS = [
  { key: 'all', label: 'Все' },
  ...LIBRARY_STATUS_VALUES.map((k) => ({ key: k, label: LIBRARY_STATUS_LABELS[k] })),
];

const EMPTY_COPY: Record<string, string> = {
  all: 'Ваша библиотека пуста. Найдите что-нибудь в каталоге и добавьте в список.',
  planning: 'В планах пока пусто. Загляните в каталог и выберите, что послушать дальше.',
  in_progress: 'Сейчас вы ничего не слушаете.',
  completed: 'Завершённых тайтлов пока нет — они появятся здесь, когда вы что-нибудь дослушаете.',
  dropped: 'Ничего не брошено. Так держать!',
};

/** Splits a translated two-tone heading on the first space: [plain, accent]. */
function splitHeading(s: string): [string, string] {
  const i = s.indexOf(' ');
  return i === -1 ? [s, ''] : [s.slice(0, i), s.slice(i + 1)];
}

export default function MyLibraryPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<LibraryEntry> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/auth/login');
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const res = await api<Paginated<LibraryEntry>>('/me/library', {
          params: {
            status: status === 'all' ? undefined : status,
            page,
            per_page: PER_PAGE,
          },
        });
        if (alive) setData(res);
      } catch (e) {
        if (alive) {
          toast(errMsg(e), 'error');
          setData({ items: [], page: 1, per_page: PER_PAGE, total: 0 });
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, status, page]);

  if (authLoading || !user) {
    return (
      <div className={styles.center}>
        <Spinner size={34} />
      </div>
    );
  }

  function handleEntryChange(
    titleId: number,
    next: { status: string; note: string } | null
  ) {
    setData((prev) => {
      if (!prev) return prev;
      if (next === null) {
        return {
          ...prev,
          items: prev.items.filter((e) => e.title.id !== titleId),
          total: Math.max(0, prev.total - 1),
        };
      }
      // Status moved out of the active filter → drop the row from this view.
      if (status !== 'all' && next.status !== status) {
        return {
          ...prev,
          items: prev.items.filter((e) => e.title.id !== titleId),
          total: Math.max(0, prev.total - 1),
        };
      }
      return {
        ...prev,
        items: prev.items.map((e) =>
          e.title.id === titleId
            ? { ...e, status: next.status as LibraryEntry['status'], note: next.note }
            : e
        ),
      };
    });
  }

  const [headPlain, headAccent] = splitHeading('Моя библиотека');

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <span className="eyebrow">{'Личная полка'}</span>
        <h1 className="section-title">
          {headPlain} <span className="accent">{headAccent}</span>
        </h1>
      </header>

      <Tabs
        tabs={TABS.map((tab) => ({ ...tab }))}
        active={status}
        onChange={(k) => {
          setStatus(k);
          setPage(1);
        }}
      />

      <div className={styles.body}>
        {loading || !data ? (
          <div className={styles.center}>
            <Spinner />
          </div>
        ) : data.items.length === 0 ? (
          <EmptyState icon={Library} title={'Nothing here'} body={EMPTY_COPY[status]} />
        ) : (
          <>
            <div className={styles.entries}>
              {data.items.map((e) => (
                <div key={e.title.id} className={`glass-panel ${styles.entry}`}>
                  <div className={styles.entryCard}>
                    <TitleCardC title={e.title} />
                  </div>
                  <div className={styles.entryWidget}>
                    <div className={styles.entryUpdated}>
                      {`Обновлено ${timeAgo(e.updated_at)}`}
                    </div>
                    <LibraryWidget
                      titleId={e.title.id}
                      entry={{ status: e.status, note: e.note }}
                      onChange={(next) => handleEntryChange(e.title.id, next)}
                    />
                  </div>
                </div>
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
      </div>
    </div>
  );
}
