'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  BookOpen,
  Library,
  MessageSquare,
  UserX,
  ArrowBigUp,
  Heart,
  Users,
  UserPlus,
  UserMinus,
  Clock,
  Check,
  X,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import {
  LIBRARY_STATUS_LABELS,
  LIBRARY_STATUS_VALUES,
  type CollectionCard,
  type FriendStatus,
  type LibraryEntry,
  type Paginated,
  type TitleCard,
  type UserBrief,
  type UserComment,
  type UserProfile,
} from '@/lib/types';
import { formatDate, initialsOf, timeAgo, presenceLabel } from '@/lib/format';
import PresenceDot from '@/components/PresenceDot/PresenceDot';
import { useAuth } from '@/lib/auth';
import { useToast, errMsg } from '@/lib/toast';
import { emitFriendsChanged } from '@/lib/friends';
import { usePageTitle } from '@/lib/usePageTitle';
import Spinner from '@/components/Spinner/Spinner';
import EmptyState from '@/components/EmptyState/EmptyState';
import LibraryRow from '@/components/LibraryRow/LibraryRow';
import Tabs from '@/components/Tabs/Tabs';
import InfiniteScroll from '@/components/InfiniteScroll/InfiniteScroll';
import { useInfiniteList } from '@/lib/useInfiniteList';
import CardGrid from '@/components/CardGrid/CardGrid';
import TitleCardC from '@/components/TitleCardC/TitleCardC';
import CollectionCardC from '@/components/CollectionCardC/CollectionCardC';
import SocialLinks from '@/components/SocialLinks/SocialLinks';
import Markdown from '@/components/Markdown/Markdown';
import UserBadges from '@/components/UserBadges/UserBadges';
import styles from './page.module.css';

const LIBRARY_STATUSES: { key: string; label: string }[] = [
  { key: 'all', label: 'Все' },
  ...LIBRARY_STATUS_VALUES.map((k) => ({ key: k, label: LIBRARY_STATUS_LABELS[k] })),
];

const LIBRARY_EMPTY_COPY: Record<string, string> = {
  all: 'В библиотеке пока пусто.',
  planning: 'В планах пока ничего нет.',
  in_progress: 'Сейчас ничего не слушает.',
  completed: 'Прослушанных тайтлов пока нет.',
  dropped: 'Ничего не брошено.',
};

const OWN_LIBRARY_EMPTY_COPY: Record<string, string> = {
  all: 'Ваша библиотека пуста. Найдите что-нибудь в каталоге и добавьте в список.',
  planning: 'В планах пока пусто. Загляните в каталог и выберите, что послушать дальше.',
  in_progress: 'Сейчас вы ничего не слушаете.',
  completed: 'Завершённых тайтлов пока нет — они появятся здесь, когда вы что-нибудь дослушаете.',
  dropped: 'Ничего не брошено. Так держать!',
};

const STAT_LABELS: { key: keyof UserProfile['stats']; label: string }[] = [
  ...LIBRARY_STATUS_VALUES.map((k) => ({
    key: k as keyof UserProfile['stats'],
    label: LIBRARY_STATUS_LABELS[k],
  })),
  { key: 'favorites', label: 'Избранное' },
  { key: 'comments', label: 'Комментарии' },
];

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

  const userRef = decodeURIComponent(params.id);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user: viewer } = useAuth();
  const { toast } = useToast();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [friendStatus, setFriendStatus] = useState<FriendStatus>('none');
  const [friendsCount, setFriendsCount] = useState(0);
  const [friendBusy, setFriendBusy] = useState(false);
  usePageTitle(profile ? profile.user.display_name || profile.user.username : null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const tabParam = searchParams.get('tab');
  const statusParam = searchParams.get('status');
  const initialTab = (tabParam === 'comments' || tabParam === 'collections' || tabParam === 'favorites' || tabParam === 'friends') ? tabParam : 'library';
  const initialStatus = statusParam && LIBRARY_STATUSES.some(s => s.key === statusParam) ? statusParam : 'all';

  const [tab, setTab] = useState<'library' | 'comments' | 'collections' | 'favorites' | 'friends'>(initialTab);
  const [libStatus, setLibStatus] = useState(initialStatus);

  const username = profile?.user.username ?? '';

  const fetchLibrary = useCallback(
    (page: number) =>
      api<Paginated<LibraryEntry>>(`/users/${encodeURIComponent(userRef)}/library`, {
        params: { status: libStatus === 'all' ? undefined : libStatus, page },
      }),
    [userRef, libStatus]
  );
  const fetchComments = useCallback(
    (page: number) =>
      api<Paginated<UserComment>>(`/users/${encodeURIComponent(userRef)}/comments`, {
        params: { page },
      }),
    [userRef]
  );
  const fetchFavorites = useCallback(
    (page: number) =>
      api<Paginated<TitleCard>>(`/users/${encodeURIComponent(userRef)}/favorites`, {
        params: { page },
      }),
    [userRef]
  );
  const fetchCollections = useCallback(
    (page: number) =>
      api<Paginated<CollectionCard>>('/collections', { params: { user: username, page } }),
    [username]
  );
  const fetchFriends = useCallback(
    (page: number) =>
      api<Paginated<UserBrief>>(`/users/${encodeURIComponent(userRef)}/friends`, {
        params: { page },
      }),
    [userRef]
  );

  const library = useInfiniteList<LibraryEntry>(fetchLibrary);
  const comments = useInfiniteList<UserComment>(fetchComments);
  const favorites = useInfiniteList<TitleCard>(fetchFavorites);
  const collections = useInfiniteList<CollectionCard>(fetchCollections);
  const friends = useInfiniteList<UserBrief>(fetchFriends);

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
    (async () => {
      try {
        const p = await api<UserProfile>(`/users/${encodeURIComponent(userRef)}`);
        if (alive) {
          setProfile(p);
          setFriendStatus(p.friendship.status);
          setFriendsCount(p.friendship.friends_count);
        }
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

  const canEditLibrary =
    viewer != null && (viewer.id === user.id || viewer.role === 'admin');
  const isOwnProfile = viewer != null && viewer.id === user.id;
  const libraryTotal = LIBRARY_STATUS_VALUES.reduce(
    (sum, k) => sum + (stats[k as keyof UserProfile['stats']] ?? 0),
    0
  );

  const handleEntryChange = (titleId: number, next: LibraryEntry) =>
    library.patch((e) => e.title.id === titleId, () => next);

  const handleEntryRemove = (titleId: number) =>
    library.remove((e) => e.title.id === titleId);

  const runFriend = async (
    method: 'POST' | 'DELETE',
    path: string,
    okMsg: string,
  ) => {
    if (friendBusy) return;
    setFriendBusy(true);
    const prev = friendStatus;
    try {
      const res = await api<{ status: FriendStatus }>(path, { method });
      setFriendStatus(res.status);
      if (res.status === 'friends' && prev !== 'friends') setFriendsCount((c) => c + 1);
      else if (res.status !== 'friends' && prev === 'friends') setFriendsCount((c) => Math.max(0, c - 1));
      emitFriendsChanged();
      toast(okMsg, 'ok');
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setFriendBusy(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.banner} aria-hidden="true">
        {user.cover_url ? (
          <img src={user.cover_url} alt="" className={styles.bannerImg} />
        ) : (
          <div className={styles.bannerEmpty}>
            <span className={styles.bannerGlow} />
            <img src="/foxgirl_user.svg" className={styles.bannerFoxgirl} alt=""/>
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
          <PresenceDot
            status={user.presence}
            lastSeenAt={user.last_seen_at}
            size={15}
            className={styles.presenceDot}
          />
        </div>

        <div className={styles.headMain}>
          <span className="eyebrow">{user.role === 'admin' ? 'администратор' : user.role === 'moderator' ? 'модератор' : 'слушатель'}</span>
          <h1 className={styles.name}>
            {user.display_name || user.username}
            <UserBadges user={user} size={15} className={styles.nameBadges} />
          </h1>
          <div className={styles.headSub}>
            {user.display_name ? <span>@{user.username}</span> : null}
            <span className={styles.metaDot} aria-hidden="true" />
            <span>{presenceLabel(user.presence, user.last_seen_at)}</span>
            {/* Cut on mobile — with username/presence already competing for one
                line, the join date is the least essential fact here. */}
            <span className={styles.joinedSince}>
              <span className={styles.metaDot} aria-hidden="true" />
              <span>{`На сайте с ${formatDate(user.created_at)}`}</span>
            </span>
          </div>
          <SocialLinks urls={user.socials} />

          {viewer && friendStatus !== 'self' ? (
            <div className={styles.friendActions}>
              <Link
                href={`/me/chat?u=${user.id}`}
                className="btn btn-ghost"
                aria-label="Написать сообщение"
              >
                <MessageSquare size={16} />
                <span className={styles.friendLabel}>Написать</span>
              </Link>
              {friendStatus === 'none' ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={friendBusy}
                  aria-label="Добавить в друзья"
                  onClick={() => runFriend('POST', `/friends/${user.id}`, 'Заявка отправлена')}
                >
                  <UserPlus size={16} />
                  <span className={styles.friendLabel}>Добавить в друзья</span>
                </button>
              ) : friendStatus === 'outgoing' ? (
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={friendBusy}
                  aria-label="Отменить заявку"
                  onClick={() => runFriend('DELETE', `/friends/${user.id}`, 'Заявка отменена')}
                >
                  <Clock size={16} />
                  <span className={styles.friendLabel}>Отменить заявку</span>
                </button>
              ) : friendStatus === 'incoming' ? (
                <>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={friendBusy}
                    aria-label="Принять заявку"
                    onClick={() => runFriend('POST', `/friends/${user.id}/accept`, 'Заявка принята')}
                  >
                    <Check size={16} />
                    <span className={styles.friendLabel}>Принять заявку</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={friendBusy}
                    aria-label="Отклонить заявку"
                    onClick={() => runFriend('DELETE', `/friends/${user.id}`, 'Заявка отклонена')}
                  >
                    <X size={16} />
                    <span className={styles.friendLabel}>Отклонить</span>
                  </button>
                </>
              ) : friendStatus === 'friends' ? (
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={friendBusy}
                  aria-label="Удалить из друзей"
                  onClick={() => runFriend('DELETE', `/friends/${user.id}`, 'Удалён из друзей')}
                >
                  <UserMinus size={16} />
                  <span className={styles.friendLabelUnfriend}>Удалить из друзей</span>
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </header>

      {user.bio ? (
        <div className={`glass-panel ${styles.bioPanel}`}>
          <span className="eyebrow">О себе</span>
          <div className={styles.bio}>
            <Markdown source={user.bio} media="image" />
          </div>
        </div>
      ) : null}

      <div className={styles.tabsWrap}>
        <Tabs
          tabs={[
            { key: 'library', label: 'Библиотека' },
            { key: 'favorites', label: 'Избранное', count: stats.favorites },
            { key: 'comments', label: 'Комментарии', count: stats.comments },
            { key: 'collections', label: 'Коллекции' },
            { key: 'friends', label: 'Друзья', count: friendsCount },
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

          <div className={styles.statusRail} role="tablist" aria-label="Список в библиотеке">
            {LIBRARY_STATUSES.map((s) => {
              const count =
                s.key === 'all'
                  ? libraryTotal
                  : stats[s.key as keyof UserProfile['stats']] ?? 0;
              return (
                <button
                  key={s.key}
                  type="button"
                  role="tab"
                  aria-selected={s.key === libStatus}
                  className={
                    s.key === libStatus
                      ? `${styles.statusChip} ${styles.statusChipActive}`
                      : styles.statusChip
                  }
                  onClick={() => {
                    setLibStatus(s.key);
                    updateUrl('library', s.key);
                  }}
                >
                  {s.label}
                  <span className={styles.statusCount}>{count}</span>
                </button>
              );
            })}
          </div>
          {library.loading || !library.items ? (
            <div className={styles.center}>
              <Spinner />
            </div>
          ) : library.items.length === 0 ? (
            <EmptyState
              icon={Library}
              title="Здесь пусто"
              body={
                isOwnProfile
                  ? OWN_LIBRARY_EMPTY_COPY[libStatus]
                  : LIBRARY_EMPTY_COPY[libStatus]
              }
            />
          ) : (
            <>

              <div className={styles.entries}>
                {library.items.map((e) => (
                  <LibraryRow
                    key={e.title.id}
                    entry={e}
                    userId={user.id}
                    canEdit={canEditLibrary}
                    isOwnShelf={isOwnProfile}
                    onChange={(next) => handleEntryChange(e.title.id, next)}
                    onRemove={() => handleEntryRemove(e.title.id)}
                  />
                ))}
              </div>
              <InfiniteScroll
                hasMore={library.hasMore}
                loading={library.loadingMore}
                error={library.moreError}
                onLoad={library.loadMore}
                total={library.total}
                shown={library.items.length}
              />
            </>
          )}
        </div>
      ) : null}

      {tab === 'comments' ? (
        <div className={styles.tabBody}>
          {comments.loading || !comments.items ? (
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
                  <Link
                    key={c.id}
                    href={`${c.target.link || ''}#comment-${c.id}`}
                    className={`glass-panel ${styles.commentCard}`}
                  >
                    <div className={styles.commentMeta}>
                      <span className={styles.commentTargetLabel}>
                        {'к'} <span className={styles.commentTarget}>{c.target.name || c.target.type}</span>
                      </span>
                      <span className={styles.commentWhen}>{timeAgo(c.created_at)}</span>
                    </div>
                    {c.is_deleted ? (
                      viewer?.role === 'admin' ? (
                        <>
                          <p className={styles.commentDeleted}>Комментарий удалён</p>
                          <CommentBody body={c.body} />
                        </>
                      ) : (
                        <p className={styles.commentDeleted}>Комментарий удалён</p>
                      )
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
                  </Link>
                ))}
              </div>
              <InfiniteScroll
                hasMore={comments.hasMore}
                loading={comments.loadingMore}
                error={comments.moreError}
                onLoad={comments.loadMore}
                total={comments.total}
                shown={comments.items.length}
              />
            </>
          )}
        </div>
      ) : null}

      {tab === 'favorites' ? (
        <div className={styles.tabBody}>
          {favorites.loading || !favorites.items ? (
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
              <InfiniteScroll
                hasMore={favorites.hasMore}
                loading={favorites.loadingMore}
                error={favorites.moreError}
                onLoad={favorites.loadMore}
                total={favorites.total}
                shown={favorites.items.length}
              />
            </>
          )}
        </div>
      ) : null}

      {tab === 'collections' ? (
        <div className={styles.tabBody}>
          {collections.loading || !collections.items ? (
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
              <InfiniteScroll
                hasMore={collections.hasMore}
                loading={collections.loadingMore}
                error={collections.moreError}
                onLoad={collections.loadMore}
                total={collections.total}
                shown={collections.items.length}
              />
            </>
          )}
        </div>
      ) : null}

      {tab === 'friends' ? (
        <div className={styles.tabBody}>
          {friends.loading || !friends.items ? (
            <div className={styles.center}>
              <Spinner />
            </div>
          ) : friends.items.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Друзей пока нет"
              body={
                isOwnProfile
                  ? 'У вас пока нет друзей. Найдите пользователей и отправьте заявку.'
                  : `У ${user.display_name || user.username} пока нет друзей.`
              }
            />
          ) : (
            <>
              <div className={styles.friendGrid}>
                {friends.items.map((f) => (
                  <FriendCard key={f.id} friend={f} />
                ))}
              </div>
              <InfiniteScroll
                hasMore={friends.hasMore}
                loading={friends.loadingMore}
                error={friends.moreError}
                onLoad={friends.loadMore}
                total={friends.total}
                shown={friends.items.length}
              />
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

function FriendCard({ friend }: { friend: UserBrief }) {
  return (
    <Link href={`/user/${friend.id}`} className={`glass-panel ${styles.friendCard}`}>
      {friend.avatar_url ? (
        <img src={friend.avatar_url} alt="" className={styles.friendAvatar} />
      ) : (
        <span className={`${styles.friendAvatar} ${styles.friendAvatarFallback}`}>
          {initialsOf(friend.username)}
        </span>
      )}
      <span className={styles.friendMeta}>
        <span className={styles.friendName}>
          {friend.display_name || friend.username}
          <UserBadges user={friend} size={9} />
        </span>
        {friend.display_name && friend.display_name !== friend.username ? (
          <span className={styles.friendHandle}>@{friend.username}</span>
        ) : null}
      </span>
    </Link>
  );
}
