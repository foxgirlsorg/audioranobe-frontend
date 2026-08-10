'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  CheckCheck,
  Clock,
  Headphones,
  ListMusic,
  Star,
} from 'lucide-react';
import { api } from '@/lib/api';
import type { Paginated, TitleCard } from '@/lib/types';
import { errMsg } from '@/lib/toast';
import { formatCount } from '@/lib/format';
import CardGrid from '@/components/CardGrid/CardGrid';
import TitleCardC from '@/components/TitleCardC/TitleCardC';
import Spinner from '@/components/Spinner/Spinner';
import EmptyState from '@/components/EmptyState/EmptyState';
import Select from '@/components/Select/Select';
import CatalogGridSkeleton from './CatalogGridSkeleton';
import styles from './CatalogGrid.module.css';

const LIMIT = 50;

type SortKey = 'updated' | 'rating' | 'listens' | 'chapters';

const SORTS: { key: SortKey; param: string; label: string; icon: typeof Clock }[] = [
  { key: 'updated', param: 'updated', label: 'Обновлению', icon: Clock },
  { key: 'rating', param: 'rating', label: 'Рейтингу', icon: Star },
  { key: 'listens', param: 'popular', label: 'Прослушиваниям', icon: Headphones },
  { key: 'chapters', param: 'chapters', label: 'Главам', icon: ListMusic },
];

const paramFor = (key: SortKey) => SORTS.find((s) => s.key === key)!.param;

export default function CatalogGrid() {
  const [items, setItems] = useState<TitleCard[] | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sort, setSort] = useState<SortKey>('updated');
  const [asc, setAsc] = useState(false);
  const [finishedOnly, setFinishedOnly] = useState(false);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    api<Paginated<TitleCard>>('/titles', {
      params: {
        per_page: LIMIT,
        page: 1,
        sort: paramFor(sort),
        hide_ai: '1',
        ...(asc ? { order: 'asc' } : {}),
        ...(finishedOnly ? { finished: '1' } : {}),
      },
    })
      .then((res) => {
        if (!alive) return;
        setItems(res.items);
        setTotal(res.total);
      })
      .catch((e) => {
        if (!alive) return;
        setItems(null);
        setError(errMsg(e));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [sort, asc, finishedOnly, nonce]);

  const catalogHref = (() => {
    const qs = new URLSearchParams();
    if (paramFor(sort) !== 'popular') qs.set('sort', paramFor(sort));
    if (asc) qs.set('order', 'asc');
    if (finishedOnly) qs.set('finished', '1');
    const s = qs.toString();
    return s ? `/catalog?${s}` : '/catalog';
  })();

  const shown = items?.length ?? 0;

  return (
    <section className={styles.wrap}>
      <header className={styles.head}>
        <div className={styles.headText}>
          <div className={styles.eyebrow}>
            <span className={styles.eyebrowBar} aria-hidden="true" />
                библиотека
          </div>
          <h2 className={styles.heading}>
            Весь <span>каталог</span>
          </h2>
        </div>
        <div className={styles.controls}>
          <div className={styles.sortRow} role="group" aria-label="Сортировка">
            <span className={styles.sortLabel}>Сортировать по</span>
            {SORTS.map((s) => (
              <button
                key={s.key}
                type="button"
                className={sort === s.key ? `${styles.sortBtn} ${styles.sortOn}` : styles.sortBtn}
                onClick={() => setSort(s.key)}
                aria-pressed={sort === s.key}
              >
                <s.icon size={13} />
                {s.label}
              </button>
            ))}
          </div>

          <div className={styles.sortSelectWrap}>
            <span className={styles.sortSelectLabel}>Сортировать по</span>
            <Select<SortKey>
              block
              className={styles.sortSelect}
              value={sort}
              options={SORTS.map((s) => ({ value: s.key, label: s.label }))}
              onChange={setSort}
              ariaLabel="Сортировать по"
            />
          </div>

          <button
            type="button"
            className={styles.invertBtn}
            onClick={() => setAsc((v) => !v)}
            aria-pressed={asc}
            title={asc ? 'Сейчас по возрастанию' : 'Сейчас по убыванию'}
            aria-label={asc ? 'Сортировать по убыванию' : 'Сортировать по возрастанию'}
          >
            {asc ? <ArrowUpNarrowWide size={15} /> : <ArrowDownWideNarrow size={15} />}
          </button>

          <button
            type="button"
            className={
              finishedOnly ? `${styles.finishedBtn} ${styles.finishedOn}` : styles.finishedBtn
            }
            onClick={() => setFinishedOnly((v) => !v)}
            aria-pressed={finishedOnly}
            title="Тайтл завершён и хотя бы один чтец завершил озвучку"
          >
            <CheckCheck size={13} />
            Только завершённые
          </button>
        </div>
      </header>

      <div className={styles.countRow}>
        {items ? <span>{`Тайтлов: ${formatCount(total)}`}</span> : null}
        {loading && items ? <Spinner size={14} inline /> : null}
      </div>

      {loading && !items ? (
        <CatalogGridSkeleton />
      ) : error ? (
        <div className={styles.center}>
          <EmptyState icon={AlertTriangle} title="Не удалось загрузить каталог" body={error} />
          <button type="button" className="btn" onClick={() => setNonce((n) => n + 1)}>
            Попробовать ещё раз
          </button>
        </div>
      ) : shown === 0 ? (
        <EmptyState
          icon={ListMusic}
          title={finishedOnly ? 'Завершённых тайтлов пока нет' : 'Каталог пока пуст'}
          body={
            finishedOnly
              ? 'Ни один тайтл ещё не завершён вместе с озвучкой. Снимите фильтр, чтобы увидеть остальные.'
              : 'Здесь появятся аудиокниги, как только их добавят.'
          }
        />
      ) : (
        <>
          <div className={loading ? `${styles.grid} ${styles.gridLoading}` : styles.grid}>
            <CardGrid fill>
              {items!.map((t) => (
                <TitleCardC key={t.id} title={t} />
              ))}
            </CardGrid>
          </div>

          {total > shown ? (
            <p className={styles.moreRow}>
              {`Показаны ${formatCount(shown)} из ${formatCount(total)} — `}
              <Link href={catalogHref} className={styles.moreLink}>
                откройте каталог
              </Link>
              {', чтобы увидеть остальные.'}
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
