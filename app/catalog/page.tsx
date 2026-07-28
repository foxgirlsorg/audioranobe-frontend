'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle, RotateCcw, SearchX, SlidersHorizontal } from 'lucide-react';
import { api } from '@/lib/api';
import {
  RELEASE_STATUS_LABELS,
  STATUS_VALUES,
  type Genre,
  type Paginated,
  type TitleCard,
} from '@/lib/types';
import { errMsg } from '@/lib/toast';
import { formatCount } from '@/lib/format';
import CardGrid from '@/components/CardGrid';
import TitleCardC from '@/components/TitleCardC';
import Pagination from '@/components/Pagination';
import Spinner from '@/components/Spinner';
import EmptyState from '@/components/EmptyState';
import GenrePicker from '@/components/GenrePicker';
import styles from './page.module.css';

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: 'popular', label: 'По прослушиваниям' },
  { value: 'rating', label: 'По рейтингу' },
  { value: 'new', label: 'Сначала новые' },
  { value: 'updated', label: 'Недавно обновлённые' },
  { value: 'az', label: 'По алфавиту' },
];

function CatalogInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sp = searchParams.toString();

  // -- current filter values, straight from the URL (single source of truth) --
  const q = searchParams.get('q') ?? '';
  const genre = searchParams.get('genre') ?? '';
  const author = searchParams.get('author') ?? '';
  const yearFrom = searchParams.get('year_from') ?? '';
  const yearTo = searchParams.get('year_to') ?? '';
  const status = searchParams.get('release_status') ?? '';
  const minRating = searchParams.get('min_rating') ?? '';
  const sort = searchParams.get('sort') ?? 'popular';
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);

  // -- local state for debounced text inputs --
  const [qInput, setQInput] = useState(q);
  const [authorInput, setAuthorInput] = useState(author);
  const [yearFromInput, setYearFromInput] = useState(yearFrom);
  const [yearToInput, setYearToInput] = useState(yearTo);

  const [genres, setGenres] = useState<Genre[]>([]);
  // The URL carries a genre slug; the picker works in ids.
  const selectedGenreIds = genre
    ? genres.filter((g) => g.slug === genre).map((g) => g.id)
    : [];
  const [data, setData] = useState<Paginated<TitleCard> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  /** Query string of the last URL we pushed ourselves (to tell our own
   *  replaces apart from external navigation like back/forward). */
  const pushedRef = useRef<string | null>(null);

  const setParams = useCallback(
    (patch: Record<string, string | null>, resetPage = true) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === '') next.delete(key);
        else next.set(key, value);
      }
      if (resetPage && !('page' in patch)) next.delete('page');
      const qs = next.toString();
      pushedRef.current = qs;
      router.replace(qs ? `/catalog?${qs}` : '/catalog', { scroll: false });
    },
    [searchParams, router]
  );

  // External URL change (back/forward, link with query) → resync the inputs.
  useEffect(() => {
    if (pushedRef.current === sp) return;
    setQInput(q);
    setAuthorInput(author);
    setYearFromInput(yearFrom);
    setYearToInput(yearTo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp]);

  // Debounce text inputs into the URL.
  useEffect(() => {
    const t = window.setTimeout(() => {
      const patch: Record<string, string | null> = {};
      if (qInput !== q) patch.q = qInput.trim() || null;
      if (authorInput !== author) patch.author = authorInput.trim() || null;
      if (yearFromInput !== yearFrom) patch.year_from = yearFromInput || null;
      if (yearToInput !== yearTo) patch.year_to = yearToInput || null;
      if (Object.keys(patch).length > 0) setParams(patch);
    }, 450);
    return () => window.clearTimeout(t);
  }, [qInput, authorInput, yearFromInput, yearToInput, q, author, yearFrom, yearTo, setParams]);

  // Genres load once.
  useEffect(() => {
    let alive = true;
    api<{ items: Genre[]; total: number }>('/genres', { params: { per_page: 500 } })
      .then((d) => {
        if (alive) setGenres(d.items ?? []);
      })
      .catch(() => {
        // non-fatal — the pills simply won't render
      });
    return () => {
      alive = false;
    };
  }, []);

  // Titles load whenever the URL query changes.
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    api<Paginated<TitleCard>>('/titles', {
      params: {
        q,
        genre,
        author,
        year_from: yearFrom,
        year_to: yearTo,
        release_status: status,
        min_rating: minRating,
        sort,
        page,
      },
    })
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp, nonce]);

  const hasFilters = Boolean(
    q || genre || author || yearFrom || yearTo || status || minRating || sort !== 'popular'
  );

  const resetFilters = () => {
    setQInput('');
    setAuthorInput('');
    setYearFromInput('');
    setYearToInput('');
    pushedRef.current = '';
    router.replace('/catalog', { scroll: false });
  };

  const onPage = (p: number) => {
    setParams({ page: p <= 1 ? null : String(p) }, false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div>
      <header className={styles.pageHead}>
        <div className="eyebrow">Вся библиотека</div>
        <h1 className={styles.pageTitle}>
          Исследуйте <span>каталог</span>
        </h1>
      </header>

      <div className={styles.layout}>
        <aside className={styles.side}>
          <div className={`glass-panel ${styles.filterCard}`}>
            <div className={styles.filterHead}>
              <SlidersHorizontal size={14} />
              Фильтры
            </div>

            <div className={styles.field}>
              <label className={styles.fLabel} htmlFor="catalog-q">
                Поиск
              </label>
              <input
                id="catalog-q"
                type="search"
                className="input"
                placeholder="Тайтл или автор…"
                value={qInput}
                onChange={(e) => setQInput(e.target.value)}
              />
            </div>

            <div className={styles.field}>
              <span className={styles.fLabel}>Жанр</span>
              <GenrePicker
                genres={genres}
                allowCreate={false}
                placeholder="Найти жанр…"
                value={selectedGenreIds}
                onChange={(ids) => {
                  // The catalog filters on a single genre slug.
                  const next = ids.length > 0 ? ids[ids.length - 1] : null;
                  const picked = next != null ? genres.find((g) => g.id === next) : null;
                  setParams({ genre: picked ? picked.slug : null });
                }}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.fLabel} htmlFor="catalog-author">
                Автор
              </label>
              <input
                id="catalog-author"
                type="text"
                className="input"
                placeholder="Например: Урсула Ле Гуин"
                value={authorInput}
                onChange={(e) => setAuthorInput(e.target.value)}
              />
            </div>

            <div className={styles.field}>
              <span className={styles.fLabel}>Год</span>
              <div className={styles.yearRow}>
                <input
                  type="number"
                  className="input"
                  placeholder="От"
                  min={0}
                  max={2100}
                  value={yearFromInput}
                  onChange={(e) => setYearFromInput(e.target.value)}
                  aria-label="Год от"
                />
                <input
                  type="number"
                  className="input"
                  placeholder="До"
                  min={0}
                  max={2100}
                  value={yearToInput}
                  onChange={(e) => setYearToInput(e.target.value)}
                  aria-label="Год до"
                />
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.fLabel} htmlFor="catalog-status">
                Статус
              </label>
              <select
                id="catalog-status"
                className="select"
                value={status}
                onChange={(e) => setParams({ release_status: e.target.value || null })}
              >
                <option value="">Любой статус</option>
                {STATUS_VALUES.map((s) => (
                  <option key={s} value={s}>
                    {RELEASE_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.field}>
              <label className={styles.fLabel} htmlFor="catalog-rating">
                Мин. рейтинг
              </label>
              <select
                id="catalog-rating"
                className="select"
                value={minRating}
                onChange={(e) => setParams({ min_rating: e.target.value || null })}
              >
                <option value="">Любой рейтинг</option>
                <option value="9">9+</option>
                <option value="8">8+</option>
                <option value="7">7+</option>
                <option value="6">6+</option>
                <option value="5">5+</option>
              </select>
            </div>

            <div className={styles.field}>
              <label className={styles.fLabel} htmlFor="catalog-sort">
                Сортировка
              </label>
              <select
                id="catalog-sort"
                className="select"
                value={sort}
                onChange={(e) =>
                  setParams({ sort: e.target.value === 'popular' ? null : e.target.value })
                }
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            {hasFilters ? (
              <button type="button" className="btn btn-ghost" onClick={resetFilters}>
                <RotateCcw />
                Сбросить фильтры
              </button>
            ) : null}
          </div>
        </aside>

        <div className={styles.main}>
          <div className={styles.resultsBar}>
            {data ? (
              <span>{`Тайтлов: ${formatCount(data.total)}`}</span>
            ) : null}
            {loading && data ? <Spinner size={14} inline /> : null}
          </div>

          {loading && !data ? (
            <div className={styles.center}>
              <Spinner size={34} />
            </div>
          ) : error ? (
            <div className={styles.center}>
              <EmptyState icon={AlertTriangle} title="Не удалось загрузить тайтлы" body={error} />
              <button type="button" className="btn" onClick={() => setNonce((n) => n + 1)}>
                Попробовать ещё раз
              </button>
            </div>
          ) : !data || data.items.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title="Тайтлы не найдены"
              body="Попробуйте смягчить или сбросить фильтры."
            />
          ) : (
            <>
              <div className={loading ? `${styles.gridWrap} ${styles.gridLoading}` : styles.gridWrap}>
                <CardGrid>
                  {data.items.map((t) => (
                    <TitleCardC key={t.id} title={t} />
                  ))}
                </CardGrid>
              </div>
              <div className={styles.pagerWrap}>
                <Pagination
                  page={data.page}
                  total={data.total}
                  perPage={data.per_page}
                  onPage={onPage}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CatalogPage() {
  return (
    <Suspense
      fallback={
        <div className={styles.center}>
          <Spinner size={34} />
        </div>
      }
    >
      <CatalogInner />
    </Suspense>
  );
}
