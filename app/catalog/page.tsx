'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  RotateCcw,
  SearchX,
  SlidersHorizontal,
} from 'lucide-react';
import { api } from '@/lib/api';
import {
  RELEASE_STATUS_LABELS,
  STATUS_VALUES,
  type Genre,
  type Paginated,
  type RequestableTitle,
  type TitleCard,
} from '@/lib/types';
import { errMsg } from '@/lib/toast';
import { formatCount } from '@/lib/format';
import CardGrid from '@/components/CardGrid/CardGrid';
import RequestableTitles from '@/components/RequestableTitles/RequestableTitles';
import TitleCardC from '@/components/TitleCardC/TitleCardC';
import Pagination from '@/components/Pagination/Pagination';
import Spinner from '@/components/Spinner/Spinner';
import EmptyState from '@/components/EmptyState/EmptyState';
import GenrePicker from '@/components/GenrePicker/GenrePicker';
import Select, { type SelectOption } from '@/components/Select/Select';
import Toggle from '@/components/Toggle/Toggle';
import styles from './page.module.css';

type CatalogData = Paginated<TitleCard> & { external?: RequestableTitle[] };

const SORT_OPTIONS: SelectOption[] = [
  { value: 'popular', label: 'По прослушиваниям' },
  { value: 'rating', label: 'По рейтингу' },
  { value: 'new', label: 'Сначала новые' },
  { value: 'updated', label: 'Недавно обновлённые' },
  { value: 'az', label: 'По алфавиту' },
  { value: 'chapters', label: 'По числу глав' },
];

const RATING_OPTIONS: SelectOption[] = [
  { value: '', label: 'Любой рейтинг' },
  ...[9, 8, 7, 6, 5].map((n) => ({ value: String(n), label: `${n}+` })),
];

function CatalogInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sp = searchParams.toString();

  const q = searchParams.get('q') ?? '';
  const genre = searchParams.get('genre') ?? '';
  const genreSlugs = genre ? genre.split(',').filter(Boolean) : [];
  const author = searchParams.get('author') ?? '';
  const yearFrom = searchParams.get('year_from') ?? '';
  const yearTo = searchParams.get('year_to') ?? '';
  const status = searchParams.get('release_status') ?? '';
  const finished = searchParams.get('finished') === '1';
  const showAi = searchParams.get('hide_ai') !== '1';
  const minRating = searchParams.get('min_rating') ?? '';
  const sort = searchParams.get('sort') ?? 'popular';
  const order = searchParams.get('order') === 'asc' ? 'asc' : 'desc';
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);

  const [qInput, setQInput] = useState(q);
  const [authorInput, setAuthorInput] = useState(author);
  const [yearFromInput, setYearFromInput] = useState(yearFrom);
  const [yearToInput, setYearToInput] = useState(yearTo);

  const [genres, setGenres] = useState<Genre[]>([]);
  const selectedGenreIds = genres
    .filter((g) => genreSlugs.includes(g.slug))
    .map((g) => g.id);
  const [data, setData] = useState<CatalogData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

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

  useEffect(() => {
    if (pushedRef.current === sp) return;
    setQInput(q);
    setAuthorInput(author);
    setYearFromInput(yearFrom);
    setYearToInput(yearTo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp]);

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

  useEffect(() => {
    let alive = true;
    api<{ items: Genre[]; total: number }>('/genres', { params: { per_page: 500 } })
      .then((d) => {
        if (alive) setGenres(d.items ?? []);
      })
      .catch(() => {
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    api<CatalogData>('/titles', {
      params: {
        q,
        genre,
        author,
        year_from: yearFrom,
        year_to: yearTo,
        release_status: status,
        finished: finished ? '1' : '',
        hide_ai: showAi ? '' : '1',
        min_rating: minRating,
        sort,
        order,
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
    q ||
      genre ||
      author ||
      yearFrom ||
      yearTo ||
      status ||
      finished ||
      !showAi ||
      minRating ||
      sort !== 'popular' ||
      order !== 'desc'
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
                placeholder="Название тайтла …"
                value={qInput}
                onChange={(e) => setQInput(e.target.value)}
              />
            </div>

            <div className={styles.field}>
              <span className={styles.fLabel}>Теги</span>
              <GenrePicker
                genres={genres}
                allowCreate={false}
                placeholder="Найти тег…"
                value={selectedGenreIds}
                onChange={(ids) => {
                  const slugs = ids
                    .map((id) => genres.find((g) => g.id === id)?.slug)
                    .filter((s): s is string => !!s);
                  setParams({ genre: slugs.length > 0 ? slugs.join(',') : null });
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
                placeholder="Например: Duichidak"
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
              <Select
                id="catalog-status"
                block
                value={status}
                placeholder="Любой статус"
                options={[
                  { value: '', label: 'Любой статус' },
                  ...STATUS_VALUES.map((s) => ({ value: s, label: RELEASE_STATUS_LABELS[s] })),
                ]}
                onChange={(v) => setParams({ release_status: v || null })}
              />
            </div>

            <div className={styles.field}>
              <Toggle
                checked={showAi}
                onChange={(on) => setParams({ hide_ai: on ? null : '1' })}
                label="Показывать ИИ-озвучку"
                hint="тайтлы, озвученные синтезированным голосом"
              />
            </div>

            <div className={styles.field}>
              <Toggle
                checked={finished}
                onChange={(on) => setParams({ finished: on ? '1' : null })}
                label="Только завершённые"
                hint="тайтл завершён и хотя бы один чтец завершил озвучку"
              />
            </div>

            <div className={styles.field}>
              <label className={styles.fLabel} htmlFor="catalog-rating">
                Мин. рейтинг
              </label>
              <Select
                id="catalog-rating"
                block
                value={minRating}
                placeholder="Любой рейтинг"
                options={RATING_OPTIONS}
                onChange={(v) => setParams({ min_rating: v || null })}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.fLabel} htmlFor="catalog-sort">
                Сортировка
              </label>
              <div className={styles.sortRow}>
                <Select
                  id="catalog-sort"
                  block
                  value={sort}
                  options={SORT_OPTIONS}
                  onChange={(v) => setParams({ sort: v === 'popular' ? null : v })}
                />
                <button
                  type="button"
                  className={styles.invertBtn}
                  onClick={() => setParams({ order: order === 'asc' ? null : 'asc' })}
                  aria-pressed={order === 'asc'}
                  title={order === 'asc' ? 'Сейчас по возрастанию' : 'Сейчас по убыванию'}
                  aria-label={
                    order === 'asc' ? 'Сортировать по убыванию' : 'Сортировать по возрастанию'
                  }
                >
                  {order === 'asc' ? (
                    <ArrowUpNarrowWide size={15} />
                  ) : (
                    <ArrowDownWideNarrow size={15} />
                  )}
                </button>
              </div>
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

          {data?.external && data.external.length > 0 ? (
            <RequestableTitles items={data.external} />
          ) : null}
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
