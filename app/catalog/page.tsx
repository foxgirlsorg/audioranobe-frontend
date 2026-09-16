'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  ArrowUpNarrowWide,
  Mic,
  RotateCcw,
  SearchX,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import {
  COUNTRY_LABELS,
  COUNTRY_VALUES,
  RELEASE_STATUS_LABELS,
  STATUS_VALUES,
  type Genre,
  type Me,
  type NarratorCard,
  type Paginated,
  type RequestableTitle,
  type TitleCard,
  type UserSearchHit,
} from '@/lib/types';
import { errMsg } from '@/lib/toast';
import { formatCount, initialsOf } from '@/lib/format';
import CardGrid from '@/components/CardGrid/CardGrid';
import RequestableTitles from '@/components/RequestableTitles/RequestableTitles';
import TitleCardC from '@/components/TitleCardC/TitleCardC';
import Pagination from '@/components/Pagination/Pagination';
import Spinner from '@/components/Spinner/Spinner';
import EmptyState from '@/components/EmptyState/EmptyState';
import GenrePicker from '@/components/GenrePicker/GenrePicker';
import Select, { type SelectOption } from '@/components/Select/Select';
import Toggle from '@/components/Toggle/Toggle';
import Tabs from '@/components/Tabs/Tabs';
import styles from './page.module.css';

type CatalogData = Paginated<TitleCard> & { external?: RequestableTitle[] };
type SearchTab = 'titles' | 'narrators' | 'users';

const SORT_OPTIONS: SelectOption[] = [
  { value: 'popular', label: 'По прослушиваниям' },
  { value: 'rating', label: 'По рейтингу' },
  { value: 'new', label: 'Сначала новые' },
  { value: 'updated', label: 'Недавно обновлённые' },
  { value: 'az', label: 'По алфавиту' },
  { value: 'chapters', label: 'По числу глав' },
];

const SEARCH_PLACEHOLDER: Record<SearchTab, string> = {
  titles: 'Название тайтла …',
  narrators: 'Имя чтеца …',
  users: 'Имя пользователя …',
};

function CatalogInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sp = searchParams.toString();
  const { user } = useAuth();

  const tab = ((): SearchTab => {
    const t = searchParams.get('tab');
    if (t === 'users') return user ? 'users' : 'titles';
    return t === 'narrators' ? t : 'titles';
  })();

  const q = searchParams.get('q') ?? '';
  const genre = searchParams.get('genre') ?? '';
  const genreSlugs = genre ? genre.split(',').filter(Boolean) : [];
  const author = searchParams.get('author') ?? '';
  const yearFrom = searchParams.get('year_from') ?? '';
  const yearTo = searchParams.get('year_to') ?? '';
  const status = searchParams.get('release_status') ?? '';
  const country = searchParams.get('country') ?? '';
  const showAi = searchParams.get('hide_ai') !== '1';
  const nsfwParam = searchParams.get('nsfw');
  const sort = searchParams.get('sort') ?? 'popular';
  const order = searchParams.get('order') === 'asc' ? 'asc' : 'desc';
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);

  const [qInput, setQInput] = useState(q);
  const [authorInput, setAuthorInput] = useState(author);
  const [yearFromInput, setYearFromInput] = useState(yearFrom);
  const [yearToInput, setYearToInput] = useState(yearTo);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [userHideNsfw, setUserHideNsfw] = useState(true);
  const show18 = nsfwParam === null ? !userHideNsfw : nsfwParam === '1';

  const [genres, setGenres] = useState<Genre[]>([]);
  const selectedGenreIds = genres
    .filter((g) => genreSlugs.includes(g.slug))
    .map((g) => g.id);
  const [data, setData] = useState<CatalogData | null>(null);
  const [narrators, setNarrators] = useState<Paginated<NarratorCard> | null>(null);
  const [users, setUsers] = useState<UserSearchHit[] | null>(null);
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
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // The 18+ switch defaults to the viewer's own content setting; the slim
  // X-Me viewer omits content_prefs, so fetch the full profile once.
  useEffect(() => {
    if (!user) {
      setUserHideNsfw(true);
      return;
    }
    let alive = true;
    api<Me>('/me')
      .then((me) => {
        if (alive) setUserHideNsfw(me.content_prefs?.hide_nsfw ?? true);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [user]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);

    const done = <T,>(set: (v: T) => void) => (v: T) => {
      if (alive) set(v);
    };
    const fail = (e: unknown) => {
      if (alive) setError(errMsg(e));
    };
    const settle = () => {
      if (alive) setLoading(false);
    };

    if (tab === 'narrators') {
      api<Paginated<NarratorCard>>('/narrators', { params: { q, page } })
        .then(done(setNarrators)).catch(fail).finally(settle);
    } else if (tab === 'users') {
      api<{ items: UserSearchHit[] }>('/users/search', { params: { q } })
        .then((r) => done(setUsers)(r.items ?? [])).catch(fail).finally(settle);
    } else {
      api<CatalogData>('/titles', {
        params: {
          q, genre, author, year_from: yearFrom, year_to: yearTo,
          release_status: status, country,
          hide_ai: showAi ? '' : '1', nsfw: nsfwParam ?? '', sort, order, page,
        },
      }).then(done(setData)).catch(fail).finally(settle);
    }
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp, nonce, tab]);

  const activeFilterCount = [
    genre, author, yearFrom, yearTo, status, country,
    showAi ? '' : '1', nsfwParam ?? '',
  ].filter(Boolean).length;

  const hasFilters = Boolean(
    q || activeFilterCount > 0 || sort !== 'popular' || order !== 'desc'
  );

  const resetFilters = () => {
    setQInput('');
    setAuthorInput('');
    setYearFromInput('');
    setYearToInput('');
    pushedRef.current = '';
    router.replace(tab === 'titles' ? '/catalog' : `/catalog?tab=${tab}`, { scroll: false });
  };

  const onPage = (p: number) => {
    setParams({ page: p <= 1 ? null : String(p) }, false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const filterFields = (
    <>
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
        <label className={styles.fLabel} htmlFor="catalog-author">Автор</label>
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
          <input type="number" className="input" placeholder="От" min={0} max={2100}
            value={yearFromInput} onChange={(e) => setYearFromInput(e.target.value)} aria-label="Год от" />
          <input type="number" className="input" placeholder="До" min={0} max={2100}
            value={yearToInput} onChange={(e) => setYearToInput(e.target.value)} aria-label="Год до" />
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.fLabel} htmlFor="catalog-status">Статус</label>
        <Select id="catalog-status" block value={status} placeholder="Любой статус"
          options={[{ value: '', label: 'Любой статус' }, ...STATUS_VALUES.map((s) => ({ value: s, label: RELEASE_STATUS_LABELS[s] }))]}
          onChange={(v) => setParams({ release_status: v || null })} />
      </div>

      <div className={styles.field}>
        <label className={styles.fLabel} htmlFor="catalog-country">Страна</label>
        <Select id="catalog-country" block value={country} placeholder="Любая страна"
          options={[{ value: '', label: 'Любая страна' }, ...COUNTRY_VALUES.map((c) => ({ value: c, label: COUNTRY_LABELS[c] }))]}
          onChange={(v) => setParams({ country: v || null })} />
      </div>

      <div className={styles.field}>
        <Toggle checked={showAi} onChange={(on) => setParams({ hide_ai: on ? null : '1' })}
          label="Показывать ИИ-озвучку" hint="тайтлы, озвученные синтезированным голосом" />
      </div>

      <div className={styles.field}>
        <Toggle
          checked={show18}
          onChange={(on) => setParams({ nsfw: on === !userHideNsfw ? null : on ? '1' : '0' })}
          label="Показывать 18+"
          hint="по умолчанию — как в настройках вашего профиля"
        />
      </div>
    </>
  );

  const sortControl = (
    <div className={styles.sortRow}>
      <Select id="catalog-sort" block value={sort} options={SORT_OPTIONS}
        onChange={(v) => setParams({ sort: v === 'popular' ? null : v })} />
      <button
        type="button"
        className={styles.invertBtn}
        onClick={() => setParams({ order: order === 'asc' ? null : 'asc' })}
        aria-pressed={order === 'asc'}
        title={order === 'asc' ? 'Сортировать по убыванию' : 'Сортировать по возрастанию'}
        aria-label={order === 'asc' ? 'Сортировать по убыванию' : 'Сортировать по возрастанию'}
      >
        <ArrowUpNarrowWide size={15} className={order === 'asc' ? undefined : styles.invertBtnFlipped} />
      </button>
    </div>
  );

  return (
    <div>
      <header className={styles.pageHead}>
        <div className="eyebrow">Вся библиотека</div>
        <h1 className={styles.pageTitle}>
          Исследуйте <span>каталог</span>
        </h1>
      </header>

      <div className={styles.searchBar}>
        <input
          id="catalog-q"
          type="search"
          className="input"
          placeholder={SEARCH_PLACEHOLDER[tab]}
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
        />
      </div>

      <Tabs
        variant="underline"
        scrollable
        active={tab}
        onChange={(k) => setParams({ tab: k === 'titles' ? null : k })}
        tabs={[
          { key: 'titles', label: 'Тайтлы' },
          { key: 'narrators', label: 'Чтецы' },
          ...(user ? [{ key: 'users', label: 'Люди' }] : []),
        ]}
      />

      <div className={styles.layout}>
        <div className={styles.main}>
          {tab === 'titles' ? (
            <div className={styles.controls}>
              <span className={styles.controlsCount}>
                {data ? `Тайтлов: ${formatCount(data.total)}` : ''}
                {loading && data ? <Spinner size={14} inline /> : null}
              </span>
              <div className={styles.controlsBtns}>
                <button
                  type="button"
                  className={activeFilterCount > 0 ? `${styles.filterBtn} ${styles.filterBtnActive}` : styles.filterBtn}
                  onClick={() => setSheetOpen(true)}
                >
                  <SlidersHorizontal size={15} />
                  Фильтры
                  {activeFilterCount > 0 ? <span className={styles.filterDot}>{activeFilterCount}</span> : null}
                </button>
                {sortControl}
              </div>
            </div>
          ) : (
            <div className={styles.resultsBar}>
              {tab === 'narrators' && narrators ? <span>{`Чтецов: ${formatCount(narrators.total)}`}</span> : null}
              {tab === 'users' && users ? <span>{`Найдено: ${formatCount(users.length)}`}</span> : null}
              {loading && (narrators || users) ? <Spinner size={14} inline /> : null}
            </div>
          )}

          {loading && !data && !narrators && !users ? (
            <div className={styles.center}><Spinner size={34} /></div>
          ) : error ? (
            <div className={styles.center}>
              <EmptyState icon={AlertTriangle} title="Не удалось загрузить" body={error} />
              <button type="button" className="btn" onClick={() => setNonce((n) => n + 1)}>
                Попробовать ещё раз
              </button>
            </div>
          ) : tab === 'titles' ? (
            !data || data.items.length === 0 ? (
              <EmptyState icon={SearchX} title="Тайтлы не найдены" body="Попробуйте смягчить или сбросить фильтры." />
            ) : (
              <>
                <div className={loading ? `${styles.gridWrap} ${styles.gridLoading}` : styles.gridWrap}>
                  <CardGrid>
                    {data.items.map((t) => <TitleCardC key={t.id} title={t} />)}
                  </CardGrid>
                </div>
                <div className={styles.pagerWrap}>
                  <Pagination page={data.page} total={data.total} perPage={data.per_page} onPage={onPage} />
                </div>
              </>
            )
          ) : tab === 'narrators' ? (
            !narrators || narrators.items.length === 0 ? (
              <EmptyState icon={SearchX} title="Чтецы не найдены" body="Попробуйте другой запрос." />
            ) : (
              <>
                <div className={loading ? `${styles.peopleGrid} ${styles.gridLoading}` : styles.peopleGrid}>
                  {narrators.items.map((n) => (
                    <Link key={n.id} href={`/narrator/${n.slug}`} className={styles.personCard}>
                      <span className={styles.personAvatar}>
                        {n.avatar_thumb_url || n.avatar_url
                          ? <img src={n.avatar_thumb_url ?? n.avatar_url ?? ''} alt="" />
                          : <Mic size={22} aria-hidden="true" />}
                      </span>
                      <span className={styles.personName}>{n.name}</span>
                      <span className={styles.personMeta}>{`${formatCount(n.titles_count)} тайтлов`}</span>
                    </Link>
                  ))}
                </div>
                <div className={styles.pagerWrap}>
                  <Pagination page={narrators.page} total={narrators.total} perPage={narrators.per_page} onPage={onPage} />
                </div>
              </>
            )
          ) : (
            !users || users.length === 0 ? (
              <EmptyState icon={SearchX} title="Пользователи не найдены" body={q ? 'Попробуйте другой запрос.' : 'Начните вводить имя пользователя.'} />
            ) : (
              <div className={styles.userList}>
                {users.map((u) => (
                  <Link key={u.id} href={`/user/${u.id}`} className={styles.userRow}>
                    <span className={styles.userAvatar}>
                      {u.avatar_thumb_url || u.avatar_url
                        ? <img src={u.avatar_thumb_url ?? u.avatar_url ?? ''} alt="" />
                        : initialsOf(u.display_name || u.username)}
                    </span>
                    <span className={styles.userMeta}>
                      <span className={styles.userName}>{u.display_name || u.username}</span>
                      <span className={styles.userHandle}>@{u.username}</span>
                    </span>
                  </Link>
                ))}
              </div>
            )
          )}

          {tab === 'titles' && data?.external && data.external.length > 0 ? (
            <RequestableTitles items={data.external} />
          ) : null}
        </div>
      </div>

      {sheetOpen ? (
        <div className={styles.sheetBackdrop} onClick={() => setSheetOpen(false)}>
          <div className={styles.sheet} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Фильтры">
            <div className={styles.sheetHead}>
              <span className={styles.sheetTitle}>Фильтры</span>
              <button type="button" className={styles.sheetClose} onClick={() => setSheetOpen(false)} aria-label="Закрыть">
                <X size={18} />
              </button>
            </div>
            <div className={styles.sheetBody}>
              {filterFields}
              {hasFilters ? (
                <button type="button" className="btn btn-ghost" onClick={resetFilters}>
                  <RotateCcw />
                  Сбросить фильтры
                </button>
              ) : null}
            </div>
            <button type="button" className={`btn btn-primary ${styles.sheetApply}`} onClick={() => setSheetOpen(false)}>
              {data ? `Показать ${formatCount(data.total)}` : 'Показать'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function CatalogPage() {
  return (
    <Suspense fallback={<div className={styles.center}><Spinner size={34} /></div>}>
      <CatalogInner />
    </Suspense>
  );
}
