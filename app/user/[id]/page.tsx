'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { BookOpen, Library, MessageSquare, UserX, ArrowBigUp, Heart } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import {
  LIBRARY_STATUS_LABELS,
  LIBRARY_STATUS_VALUES,
  type CollectionCard,
  type LibraryEntry,
  type Paginated,
  type TitleCard,
  type UserComment,
  type UserProfile,
} from '@/lib/types';
import { formatDate, timeAgo } from '@/lib/format';
import Spinner from '@/components/Spinner';
import EmptyState from '@/components/EmptyState';
import Tabs from '@/components/Tabs';
import Pagination from '@/components/Pagination';
import CardGrid from '@/components/CardGrid';
import TitleCardC from '@/components/TitleCardC';
import CollectionCardC from '@/components/CollectionCardC';
import SocialLinks from '@/components/SocialLinks';
import styles from './page.module.css';

const LIBRARY_STATUSES: { key: string; label: string }[] = LIBRARY_STATUS_VALUES.map((k) => ({
  key: k,
  label: LIBRARY_STATUS_LABELS[k],
}));

const STAT_LABELS: { key: keyof UserProfile['stats']; label: string }[] = [
  ...LIBRARY_STATUS_VALUES.map((k) => ({
    key: k as keyof UserProfile['stats'],
    label: LIBRARY_STATUS_LABELS[k],
  })),
  { key: 'favorites', label: 'Избранное' },
  { key: 'comments', label: 'Комментарии' },
];

function initialsOf(username: string): string {
  const parts = username.split(/[_\-.]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return username.slice(0, 2).toUpperCase();
}

function CommentBody({ body }: { body: string }) {
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const parts: { text: string; spoiler: boolean }[] = [];
  const re = /\|\|([\s\S]+?)\|\|/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    if (m.index > last) parts.push({ text: body.slice(last, m.index), spoiler: false });
    parts.push({ text: m[1], spoiler: true });
    last = m.index + m[0].length;
  }
  if (last < body.length) parts.push({ text: body.slice(last), spoiler: false });

  return (
    <p className={styles.commentBody}>
      {parts.map((p, i) =>
        p.spoiler && !revealed.has(i) ? (
          <span
            key={i}
            className={styles.spoiler}
            role="button"
            tabIndex={0}
            title="Показать спойлер"
            onClick={() => setRevealed((prev) => new Set(prev).add(i))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setRevealed((prev) => new Set(prev).add(i));
              }
            }}
          >
            {p.text}
          </span>
        ) : (
          <span key={i}>{p.text}</span>
        )
      )}
    </p>
  );
}

export default function UserProfilePage({ params }: { params: { id: string } }) {
  // Profiles are addressed by id; the backend still resolves a username here
  // so links minted before the switch keep working.
  const userRef = decodeURIComponent(params.id);
  const router = useRouter();
  const searchParams = useSearchParams();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const tabParam = searchParams.get('tab');
  const statusParam = searchParams.get('status');
  const initialTab = (tabParam === 'comments' || tabParam === 'collections' || tabParam === 'favorites') ? tabParam : 'library';
  const initialStatus = statusParam && LIBRARY_STATUSES.some(s => s.key === statusParam) ? statusParam : 'planning';

  const [tab, setTab] = useState<'library' | 'comments' | 'collections' | 'favorites'>(initialTab);
  const [libStatus, setLibStatus] = useState(initialStatus);

  const [library, setLibrary] = useState<Paginated<LibraryEntry> | null>(null);
  const [comments, setComments] = useState<Paginated<UserComment> | null>(null);
  const [collections, setCollections] = useState<Paginated<CollectionCard> | null>(null);
  const [favorites, setFavorites] = useState<Paginated<TitleCard> | null>(null);
  const [tabLoading, setTabLoading] = useState(false);
  const [libPage, setLibPage] = useState(1);
  const [comPage, setComPage] = useState(1);
  const [colPage, setColPage] = useState(1);
  const [favPage, setFavPage] = useState(1);

  const updateUrl = useCallback((newTab: string, newStatus?: string) => {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set('tab', newTab);
    if (newTab === 'library' && newStatus) {
      sp.set('status', newStatus);
    } else {
      sp.delete('status');
    }
    router.push(`?${sp.toString()}`, { scroll: false });
  }, [router, searchParams]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    setProfile(null);
    setTab(initialTab);
    setLibStatus(initialStatus);
    setLibPage(1);
    setComPage(1);
    setColPage(1);
    setFavPage(1);
    (async () => {
      try {
        const p = await api<UserProfile>(`/users/${encodeURIComponent(userRef)}`);
        if (alive) setProfile(p);
      } catch (e) {
        if (!alive) return;
        if (e instanceof ApiError && e.status === 404) setError('Такого пользователя не существует.');
        else setError(e instanceof Error ? e.message : 'Не удалось загрузить профиль.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [userRef]);

  // Per-tab data loading.
  useEffect(() => {
    if (!profile) return;
    let alive = true;
    setTabLoading(true);
    (async () => {
      try {
        if (tab === 'library') {
          const res = await api<Paginated<LibraryEntry>>(
            `/users/${encodeURIComponent(userRef)}/library`,
            { params: { status: libStatus, page: libPage } }
          );
          if (alive) setLibrary(res);
        } else if (tab === 'comments') {
          const res = await api<Paginated<UserComment>>(
            `/users/${encodeURIComponent(userRef)}/comments`,
            { params: { page: comPage } }
          );
          if (alive) setComments(res);
        } else {
          const res = await api<Paginated<CollectionCard>>('/collections', {
            params: { user: profile.user.username, page: colPage },
          });
          if (alive) setCollections(res);
        }
      } catch {
        if (alive) {
          if (tab === 'library') setLibrary({ items: [], page: 1, per_page: 24, total: 0 });
          else if (tab === 'comments')
            setComments({ items: [], page: 1, per_page: 24, total: 0 });
          else if (tab === 'favorites')
            setFavorites({ items: [], page: 1, per_page: 24, total: 0 });
          else setCollections({ items: [], page: 1, per_page: 24, total: 0 });
        }
      } finally {
        if (alive) setTabLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [profile, tab, libStatus, libPage, comPage, colPage, favPage, userRef]);

  if (loading) {
    return (
      <div className={styles.center}>
        <Spinner size={34} />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className={styles.center}>
        <EmptyState
          icon={UserX}
          title="Пользователь не найден"
          body={error ?? 'Не удалось загрузить профиль.'}
        />
      </div>
    );
  }

  const { user, stats } = profile;

  return (
    <div className={styles.page}>
      <div className={styles.banner} aria-hidden="true">
        {user.cover_url ? (
          <img src={user.cover_url} alt="" className={styles.bannerImg} />
        ) : user.avatar_url ? (
          <img src={user.avatar_url} alt="" className={`${styles.bannerImg} ${styles.bannerBlur}`} />
        ) : (
          <div className={styles.bannerEmpty}>
            <span className={styles.bannerGlow} />
          </div>
        )}
        <div className={styles.bannerShade} />
      </div>

      <header className={styles.head}>
        <div className={styles.avatar}>
          {user.avatar_url ? (
            <img src={user.avatar_url} alt={user.username} className={styles.avatarImg} />
          ) : (
            <span className={styles.avatarInitials}>{initialsOf(user.username)}</span>
          )}
        </div>

        <div className={styles.headMain}>
          <span className="eyebrow">Профиль слушателя</span>
          <h1 className={styles.name}>
            {user.display_name || user.username}
            {user.role === 'admin' ? <span className="badge">Админ</span> : null}
            {user.role === 'moderator' ? <span className="badge">Модератор</span> : null}
          </h1>
          {/* The handle stays visible even when a display name is set — it is
              what someone needs in order to @mention this person. */}
          {user.display_name ? <div className={styles.handle}>@{user.username}</div> : null}
          <div className={styles.since}>{`На сайте с ${formatDate(user.created_at)}`}</div>
          <SocialLinks urls={user.socials} />
        </div>
      </header>

      {user.bio ? (
        <div className={`glass-panel ${styles.bioPanel}`}>
          <span className="eyebrow">О себе</span>
          <p className={styles.bio}>{user.bio}</p>
        </div>
      ) : null}

      <div className={styles.statsRow} aria-label="Статистика профиля">
        {STAT_LABELS.map((s) => {
          const isLibraryStatus = s.key !== 'comments' && s.key !== 'favorites';
          const isActive = isLibraryStatus
            ? tab === 'library' && libStatus === s.key
            : s.key === 'favorites'
              ? tab === 'favorites'
              : tab === 'comments';
          return (
            <button
              key={s.key}
              type="button"
              className={`${styles.statChip}${isActive ? ` ${styles.statChipActive}` : ''}`}
              onClick={() => {
                if (isLibraryStatus) {
                  updateUrl('library', s.key);
                  setTab('library');
                  setLibStatus(s.key);
                  setLibPage(1);
                } else if (s.key === 'favorites') {
                  updateUrl('favorites');
                  setTab('favorites');
                  setFavPage(1);
                } else {
                  updateUrl('comments');
                  setTab('comments');
                  setComPage(1);
                }
              }}
            >
              <span className={styles.statValue}>{stats[s.key]}</span>
              <span className={styles.statLabel}>{s.label}</span>
            </button>
          );
        })}
      </div>

      <div className={styles.tabsWrap}>
        <Tabs
          tabs={[
            { key: 'library', label: 'Библиотека' },
            { key: 'favorites', label: 'Избранное', count: stats.favorites },
            { key: 'comments', label: 'Комментарии', count: stats.comments },
            { key: 'collections', label: 'Коллекции' },
          ]}
          active={tab}
          onChange={(k) => {
            const newTab = k as typeof tab;
            setTab(newTab);
            updateUrl(newTab, libStatus);
          }}
        />
      </div>

      {tab === 'library' ? (
        <div className={styles.tabBody}>
          <div className={styles.subTabs}>
            <Tabs
              tabs={LIBRARY_STATUSES.map((s) => ({
                key: s.key,
                label: s.label,
                count: stats[s.key as keyof UserProfile['stats']],
              }))}
              active={libStatus}
              onChange={(k) => {
                setLibStatus(k);
                setLibPage(1);
                updateUrl('library', k);
              }}
            />
          </div>
          {tabLoading || !library ? (
            <div className={styles.center}>
              <Spinner />
            </div>
          ) : library.items.length === 0 ? (
            <EmptyState
              icon={Library}
              title="Здесь пусто"
              body={`У ${user.username} нет тайтлов в этом списке.`}
            />
          ) : (
            <>
              <CardGrid>
                {library.items.map((e) => (
                  <div key={e.title.id}>
                    <TitleCardC title={e.title} />
                    {e.note ? (
                      <div className={styles.libNote}>
                        <span className={styles.libNoteText}>{e.note}</span>
                      </div>
                    ) : null}
                  </div>
                ))}
              </CardGrid>
              <Pagination
                page={library.page}
                total={library.total}
                perPage={library.per_page}
                onPage={setLibPage}
              />
            </>
          )}
        </div>
      ) : null}

      {tab === 'comments' ? (
        <div className={styles.tabBody}>
          {tabLoading || !comments ? (
            <div className={styles.center}>
              <Spinner />
            </div>
          ) : comments.items.length === 0 ? (
            <EmptyState
              icon={MessageSquare}
              title="Комментариев пока нет"
              body={`У ${user.username} пока нет ни одного комментария.`}
            />
          ) : (
            <>
              <div className={styles.commentList}>
                {comments.items.map((c) => (
                  <article key={c.id} className={`glass-panel ${styles.commentCard}`}>
                    <div className={styles.commentMeta}>
                      <span className={styles.commentTargetLabel}>
                        {'к'}{' '}
                        <Link href={c.target.link || '#'} className={styles.commentTarget}>
                          {c.target.name || c.target.type}
                        </Link>
                      </span>
                      <span className={styles.commentWhen}>{timeAgo(c.created_at)}</span>
                    </div>
                    {c.is_deleted ? (
                      <p className={styles.commentDeleted}>Комментарий удалён</p>
                    ) : (
                      <CommentBody body={c.body} />
                    )}
                    <div className={styles.commentFoot}>
                      <span
                        className={
                          c.score > 0
                            ? `${styles.score} ${styles.scoreUp}`
                            : c.score < 0
                              ? `${styles.score} ${styles.scoreDown}`
                              : styles.score
                        }
                      >
                        <ArrowBigUp size={14} />
                        {c.score}
                      </span>
                      {c.updated_at ? <span className={styles.edited}>изменено</span> : null}
                    </div>
                  </article>
                ))}
              </div>
              <Pagination
                page={comments.page}
                total={comments.total}
                perPage={comments.per_page}
                onPage={setComPage}
              />
            </>
          )}
        </div>
      ) : null}

      {tab === 'favorites' ? (
        <div className={styles.tabBody}>
          {tabLoading || !favorites ? (
            <div className={styles.center}>
              <Spinner />
            </div>
          ) : favorites.items.length === 0 ? (
            <EmptyState
              icon={Heart}
              title="Избранного пока нет"
              body={`У ${user.username} нет избранных тайтлов.`}
            />
          ) : (
            <>
              <CardGrid>
                {favorites.items.map((tc) => (
                  <TitleCardC key={tc.id} title={tc} />
                ))}
              </CardGrid>
              <Pagination
                page={favorites.page}
                total={favorites.total}
                perPage={favorites.per_page}
                onPage={setFavPage}
              />
            </>
          )}
        </div>
      ) : null}

      {tab === 'collections' ? (
        <div className={styles.tabBody}>
          {tabLoading || !collections ? (
            <div className={styles.center}>
              <Spinner />
            </div>
          ) : collections.items.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="Коллекций нет"
              body={`У ${user.username} нет опубликованных коллекций.`}
            />
          ) : (
            <>
              <CardGrid>
                {collections.items.map((c) => (
                  <CollectionCardC key={c.id} collection={c} />
                ))}
              </CardGrid>
              <Pagination
                page={collections.page}
                total={collections.total}
                perPage={collections.per_page}
                onPage={setColPage}
              />
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
