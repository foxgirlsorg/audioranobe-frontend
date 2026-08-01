'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Headphones, History, Play } from 'lucide-react';
import { api } from '@/lib/api';
import type { HistoryItem, Paginated } from '@/lib/types';
import { useAuth } from '@/lib/auth';
import { usePlayer } from '@/lib/player';
import { useToast, errMsg } from '@/lib/toast';
import { formatDuration, timeAgo } from '@/lib/format';
import Spinner from '@/components/Spinner/Spinner';
import EmptyState from '@/components/EmptyState/EmptyState';
import Pagination from '@/components/Pagination/Pagination';
import styles from './page.module.css';

function splitHeading(s: string): [string, string] {
  const i = s.indexOf(' ');
  return i === -1 ? [s, ''] : [s.slice(0, i), s.slice(i + 1)];
}

export default function MyHistoryPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const { playChapter } = usePlayer();

  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<HistoryItem> | null>(null);
  const [loading, setLoading] = useState(true);
  const [resuming, setResuming] = useState<number | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/auth/login');
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const res = await api<Paginated<HistoryItem>>('/me/history', { params: { page } });
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

  async function resume(chapterId: number) {
    if (resuming !== null) return;
    setResuming(chapterId);
    try {
      await playChapter(chapterId);
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setResuming(null);
    }
  }

  const [headPlain, headAccent] = splitHeading('История прослушивания');

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <span className="eyebrow">{'Где вы остановились'}</span>
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
          icon={History}
          title={'Истории прослушивания пока нет'}
          body={'Включите любую главу — и прогресс будет сохраняться здесь.'}
        />
      ) : (
        <>
          <div className={styles.rows}>
            {data.items.map((h) => {
              const dur = h.chapter.duration_seconds || 0;
              const pct =
                dur > 0 ? Math.min(100, Math.max(0, (h.position_seconds / dur) * 100)) : 0;
              return (
                <div key={h.chapter.id} className={`glass-panel ${styles.row}`}>
                  <Link
                    href={`/title/${h.title.slug}`}
                    className={styles.thumb}
                    title={h.title.name}
                  >
                    {h.title.cover_url ? (
                      <img
                        src={h.title.cover_url}
                        alt={h.title.name}
                        className={styles.thumbImg}
                        loading="lazy"
                      />
                    ) : (
                      <span className={styles.thumbFallback}>
                        <Headphones size={20} />
                      </span>
                    )}
                  </Link>

                  <div className={styles.rowMain}>
                    <Link href={`/title/${h.title.slug}`} className={styles.titleLink}>
                      {h.title.name}
                    </Link>
                    <Link href={`/chapter/${h.chapter.id}`} className={styles.chapterLink}>
                      {`Глава ${h.chapter.number}`}
                      {h.chapter.name ? ` — ${h.chapter.name}` : ''}
                    </Link>
                    <div className={styles.progressWrap}>
                      <div
                        className={styles.progressBar}
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(pct)}
                      >
                        <span className={styles.progressFill} style={{ width: `${pct}%` }} />
                      </div>
                      <span className={styles.progressText}>
                        {formatDuration(h.position_seconds)}
                        {dur > 0 ? ` / ${formatDuration(dur)}` : ''}
                      </span>
                    </div>
                  </div>

                  <div className={styles.rowSide}>
                    <span className={styles.when}>{timeAgo(h.updated_at)}</span>
                    <button
                      type="button"
                      className={styles.resume}
                      onClick={() => resume(h.chapter.id)}
                      disabled={resuming !== null}
                      title={'Продолжить прослушивание'}
                    >
                      {resuming === h.chapter.id ? (
                        <Spinner size={14} inline />
                      ) : (
                        <Play size={14} />
                      )}
                      {'Продолжить'}
                    </button>
                  </div>
                </div>
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
