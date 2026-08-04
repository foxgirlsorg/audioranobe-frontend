'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Megaphone, Newspaper } from 'lucide-react';
import { api } from '@/lib/api';
import type { Announcement, Paginated } from '@/lib/types';
import { errMsg } from '@/lib/toast';
import { formatDate } from '@/lib/format';
import Pagination from '@/components/Pagination/Pagination';
import Spinner from '@/components/Spinner/Spinner';
import EmptyState from '@/components/EmptyState/EmptyState';
import Markdown from '@/components/Markdown/Markdown';
import styles from './page.module.css';

export default function NewsPage() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<Announcement> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    api<Paginated<Announcement>>('/announcements', { params: { page } })
      .then((d) => {
        if (alive) setData(d);
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
  }, [page, nonce]);

  const onPage = (p: number) => {
    setPage(p);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className={styles.page}>
      <header className={styles.pageHead}>
        <div className="eyebrow">{'Что происходит на AudioRanobe'}</div>
        <h1 className={styles.pageTitle}>
          {'Новости'} <span>{'сайта'}</span>
        </h1>
      </header>

      {loading && !data ? (
        <div className={styles.center}>
          <Spinner size={34} />
        </div>
      ) : error ? (
        <div className={styles.center}>
          <EmptyState icon={AlertTriangle} title={'Не удалось загрузить новости'} body={error} />
          <button type="button" className="btn" onClick={() => setNonce((n) => n + 1)}>
            {'Попробовать ещё раз'}
          </button>
        </div>
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          icon={Newspaper}
          title={'Объявлений пока нет'}
          body={'Когда команда опубликует новости, они появятся здесь.'}
        />
      ) : (
        <>
          <div className={loading ? `${styles.list} ${styles.listLoading}` : styles.list}>
            {data.items.map((a) => (
              <article key={a.id} className={`glass-panel ${styles.card}`}>
                <div className={styles.cardHead}>
                  <span className={styles.cardIcon}>
                    <Megaphone size={15} />
                  </span>
                  <span className={styles.cardDate}>{formatDate(a.created_at)}</span>
                  {a.author ? (
                    <span className={styles.cardAuthor}>
                      {`от ${a.author.username}`}
                    </span>
                  ) : null}
                </div>
                <h2 className={styles.cardTitle}>
                  <Link href={`/news/${a.slug}`} className={styles.cardLink}>
                    {a.title}
                  </Link>
                </h2>
                {a.body ? (
                  <div className={styles.cardBody}>
                    <Markdown source={a.body} media="both" />
                  </div>
                ) : null}
                <Link href={`/news/${a.slug}`} className={styles.cardMore}>
                  {'Читать полностью'}
                </Link>
              </article>
            ))}
          </div>
          <div className={styles.pagerWrap}>
            <Pagination page={data.page} total={data.total} perPage={data.per_page} onPage={onPage} />
          </div>
        </>
      )}
    </div>
  );
}
