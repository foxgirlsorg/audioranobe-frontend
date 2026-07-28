'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Heart } from 'lucide-react';
import { api } from '@/lib/api';
import type { Paginated, TitleCard } from '@/lib/types';
import { useAuth } from '@/lib/auth';
import { useToast, errMsg } from '@/lib/toast';
import Spinner from '@/components/Spinner';
import EmptyState from '@/components/EmptyState';
import CardGrid from '@/components/CardGrid';
import TitleCardC from '@/components/TitleCardC';
import Pagination from '@/components/Pagination';
import styles from './page.module.css';

/** Splits a translated two-tone heading on the first space: [plain, accent]. */
function splitHeading(s: string): [string, string] {
  const i = s.indexOf(' ');
  return i === -1 ? [s, ''] : [s.slice(0, i), s.slice(i + 1)];
}

export default function MyFavoritesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<TitleCard> | null>(null);
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
        const res = await api<Paginated<TitleCard>>('/me/favorites', { params: { page } });
        if (alive) setData(res);
      } catch (e) {
        if (alive) {
          toast(errMsg(e), 'error');
          setData({ items: [], page: 1, per_page: 24, total: 0 });
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, page]);

  if (authLoading || !user) {
    return (
      <div className={styles.center}>
        <Spinner size={34} />
      </div>
    );
  }

  const [headPlain, headAccent] = splitHeading('Моё избранное');

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <span className="eyebrow">{'Отобрано вручную'}</span>
        <h1 className="section-title">
          {headPlain} <span className="accent">{headAccent}</span>
        </h1>
      </header>

      {loading || !data ? (
        <div className={styles.center}>
          <Spinner />
        </div>
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={Heart}
          title={'В избранном пока пусто'}
          body={'Нажмите на сердечко на странице тайтла — и он появится здесь.'}
        />
      ) : (
        <>
          <CardGrid>
            {data.items.map((tc) => (
              <TitleCardC key={tc.id} title={tc} />
            ))}
          </CardGrid>
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
