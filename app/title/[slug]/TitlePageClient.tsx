'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  Calendar,
  ChevronDown,
  Clock,
  Disc3,
  Download,
  Eye,
  Headphones,
  Info,
  ListMusic,
  Lock,
  Mic,
  PenLine,
  Pencil,
  Pause,
  Play,
  RefreshCw,
  ShieldAlert,
  Star,
  type LucideIcon,
} from 'lucide-react';
import { api, API_URL, ApiError } from '@/lib/api';
import {
  NARRATION_STATUS_LABELS,
  RELEASE_STATUS_LABELS,
  type ChapterRow,
  type NarrationStatus,
  type TitleFull,
  type Volume,
} from '@/lib/types';
import { useAuth } from '@/lib/auth';
import { usePlayer, usePlayerPosition } from '@/lib/player';
import { useToast, errMsg } from '@/lib/toast';
import { chapterFilePrefix, formatCount, formatDuration } from '@/lib/format';
import { usePageTitle } from '@/lib/usePageTitle';
import Section from '@/components/Section/Section';
import Tabs from '@/components/Tabs/Tabs';
import ScrollRail from '@/components/ScrollRail/ScrollRail';
import TitleCardC from '@/components/TitleCardC/TitleCardC';
import RatingStars from '@/components/RatingStars/RatingStars';
import RatingBars from '@/components/RatingBars/RatingBars';
import CommentSection from '@/components/CommentSection/CommentSection';
import LibraryWidget from '@/components/LibraryWidget/LibraryWidget';
import FavoriteButton from '@/components/FavoriteButton/FavoriteButton';
import StatusBadge from '@/components/StatusBadge/StatusBadge';
import Skeleton from 'react-loading-skeleton';
import EmptyState from '@/components/EmptyState/EmptyState';
import { PhotoView } from 'react-photo-view';
import Markdown from '@/components/Markdown/Markdown';
import ArchiveDownloadButton, { type ArchiveItem } from '@/components/ArchiveDownloadButton/ArchiveDownloadButton';
import AiBadge from '@/components/AiBadge/AiBadge';
import VerifiedBadge from '@/components/VerifiedBadge/VerifiedBadge';
import { SUPPORT_URL } from '@/lib/support';
import styles from './page.module.css';

const DESC_CLAMP_CHARS = 420;

function volumeDuration(v: Volume): number {
  return v.chapters.reduce((sum, c) => sum + (c.duration_seconds || 0), 0);
}

const STATUS_TONE: Record<NarrationStatus, string> = {
  ongoing: 'toneLive',
  completed: 'toneDone',
  frozen: 'toneFrozen',
  abandoned: 'toneDropped',
};

function sharedNarrationStatus(
  narrators: { narration_status: NarrationStatus }[]
): NarrationStatus | null {
  if (narrators.length === 0) return null;
  const first = narrators[0].narration_status;
  return narrators.every((n) => n.narration_status === first) ? first : null;
}

/**
 * The title page ships two distinct layouts — the desktop split (cover + rail +
 * tabs) and an app-style single-column mobile layout — so this is a real
 * breakpoint switch, not a CSS reflow. Starts `false` (server + first paint =
 * desktop markup) and corrects on mount to avoid a hydration mismatch.
 */
function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const sync = () => setMobile(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  return mobile;
}

/**
 * Renders only the currently-playing chapter row's progress fill, subscribed
 * to usePlayerPosition() (ticks ~4x/sec during playback). Isolating the tick
 * subscription here — instead of on the whole chapter list — means only this
 * one small leaf re-renders on tick, not the entire (potentially
 * many-hundred-chapter) page.
 */
function ChapterProgressBar({ fallbackDuration }: { fallbackDuration: number }) {
  const { duration } = usePlayer();
  const { position } = usePlayerPosition();
  const dur = duration > 0 ? duration : fallbackDuration;
  const pct = dur > 0 ? Math.min(100, (position / dur) * 100) : 0;
  if (pct <= 0) return null;
  return (
    <div className={styles.progress} aria-hidden="true">
      <div className={styles.progressFill} style={{ width: `${pct}%` }} />
    </div>
  );
}

function TitlePageSkeleton() {
  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.top}>
          <div className={styles.coverCol}>
            <div className={styles.coverPanel}>
              <Skeleton height="100%" style={{ display: 'block' }} />
            </div>
          </div>
          <div className={styles.headinfo}>
            <div className={styles.name}>
              <Skeleton width="70%" />
            </div>
            <Skeleton width={160} height={14} />
            <Skeleton width="95%" count={2} />
            <Skeleton width={160} height={38} borderRadius={10} />
          </div>
        </div>
      </header>
    </div>
  );
}

export default function TitlePageClient({
  slug: rawSlug,
  initialTitle,
}: {
  slug: string;
  initialTitle: TitleFull | null;
}) {
  const slug = decodeURIComponent(rawSlug);
  const { user, isMod } = useAuth();
  const player = usePlayer();
  const { toast } = useToast();

  const [title, setTitle] = useState<TitleFull | null>(initialTitle);
  const [loading, setLoading] = useState(initialTitle === null);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [openVols, setOpenVols] = useState<Record<number, boolean>>({});
  const [descOpen, setDescOpen] = useState(false);
  const [tab, setTab] = useState('chapters');
  const [mobileTab, setMobileTab] = useState('about');
  const isMobile = useIsMobile();
  const [ratingOpen, setRatingOpen] = useState(false);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [tagsClipped, setTagsClipped] = useState(false);
  const tagsRef = useRef<HTMLParagraphElement | null>(null);
  const canEdit = title?.can_edit ?? false;
  const [reNarrating, setReNarrating] = useState<number | null>(null);
  const skipInitialFetch = useRef(initialTitle !== null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const full = await api<TitleFull>(`/titles/${encodeURIComponent(slug)}`);
      setTitle(full);

      setOpenVols({});
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        setMissing(true);
      } else {
        setError(errMsg(e));
      }
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    if (skipInitialFetch.current) {
      skipInitialFetch.current = false;
      return;
    }
    void load();
  }, [load]);

  // The SSR response may have been served from Cloudflare's public cache
  // (can_edit: false, my_rating/my_library/my_favorite: null) even for the
  // page owner.  Once auth resolves and we know who the viewer is, silently
  // re-fetch so those user-specific fields reflect the real session.
  const didUserRefetch = useRef(false);
  useEffect(() => {
    if (!user || didUserRefetch.current) return;
    didUserRefetch.current = true;
    api<TitleFull>(`/titles/${encodeURIComponent(slug)}`)
      .then(setTitle)
      .catch(() => {}); // best-effort; stale data is better than an error flash
  }, [user, slug]);

  usePageTitle(title?.name);

  useEffect(() => {
    const el = tagsRef.current;
    if (!el) return;
    const measure = () => {
      const line = parseFloat(getComputedStyle(el).lineHeight) || 18;
      setTagsClipped(el.scrollHeight > line * 2 + 1);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [title, tagsOpen]);

  const playableChapters = useMemo(() => {
    if (!title) return [] as ChapterRow[];
    const out: ChapterRow[] = [];
    for (const v of title.volumes) {
      for (const c of v.chapters) {
        if (c.audio_status === 'ready' && c.mod_status === 'approved') out.push(c);
      }
    }
    return out;
  }, [title]);

  const resume = useMemo(() => {
    if (playableChapters.length === 0) return null;
    let idx = -1;
    for (let i = 0; i < playableChapters.length; i++) {
      const c = playableChapters[i];
      if (c.my_position != null && c.my_position > 0) idx = i;
    }
    if (idx === -1) return { chapter: playableChapters[0], continued: false };
    const c = playableChapters[idx];
    const finished = c.duration_seconds > 0 && (c.my_position ?? 0) >= c.duration_seconds - 5;
    if (finished && idx + 1 < playableChapters.length) {
      return { chapter: playableChapters[idx + 1], continued: true };
    }
    return { chapter: c, continued: true };
  }, [playableChapters]);

  async function playChapter(ch: ChapterRow) {
    if (player.current?.id === ch.id) {
      player.toggle();
      return;
    }
    try {
      await player.playChapter(ch.id);
    } catch (e) {
      toast(errMsg(e), 'error');
    }
  }

  function downloadChapter(chapterId: number) {
    const a = document.createElement('a');
    a.href = `${API_URL}/download/chapters/${chapterId}`;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function reNarrate(ch: ChapterRow) {
    if (reNarrating) return;
    setReNarrating(ch.id);
    try {
      await api(`/mod/chapters/${ch.id}/re-narrate`, { method: 'POST' });
      toast(`Глава ${ch.number} отправлена на переозвучку`, 'ok');
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setReNarrating(null);
    }
  }

  function archiveItems(volumes: Volume[], foldered: boolean): ArchiveItem[] {
    const out: ArchiveItem[] = [];
    for (const v of volumes) {
      for (const c of v.chapters) {
        if (c.audio_status !== 'ready') continue;
        const label = c.name || `Глава ${c.number}`;
        out.push({
          id: c.id,
          name: `${chapterFilePrefix(c.number)}. ${label}.opus`,
          folder: foldered ? `Том ${v.number}` : undefined,
        });
      }
    }
    return out;
  }

  async function rate(v: number | null) {
    if (!title) return;
    try {
      const res = await api<{
        avg_rating: number | null;
        rating_count: number;
        my_rating: number | null;
      }>(
        `/titles/${title.id}/rating`,
        v === null ? { method: 'DELETE' } : { method: 'PUT', body: { value: v } }
      );
      setTitle((prev) => {
        if (!prev) return prev;
        const dist = { ...prev.rating_distribution };
        if (prev.my_rating != null) {
          dist[String(prev.my_rating)] = Math.max(0, (dist[String(prev.my_rating)] ?? 0) - 1);
        }
        if (res.my_rating != null) {
          dist[String(res.my_rating)] = (dist[String(res.my_rating)] ?? 0) + 1;
        }
        return {
          ...prev,
          avg_rating: res.avg_rating,
          rating_count: res.rating_count,
          my_rating: res.my_rating,
          rating_distribution: dist,
        };
      });
    } catch (e) {
      toast(errMsg(e), 'error');
    }
  }

  function toggleVolume(id: number) {
    setOpenVols((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  if (missing) notFound();

  if (loading) {
    return <TitlePageSkeleton />;
  }

  if (error || !title) {
    return (
      <div className={styles.errorWrap}>
        <EmptyState
          icon={Headphones}
          title={'Не удалось загрузить тайтл'}
          body={error ?? 'Что-то пошло не так.'}
        />
        <button type="button" className="btn" onClick={() => void load()}>
          <RefreshCw size={14} />
          {'Попробовать ещё раз'}
        </button>
      </div>
    );
  }

  const bg = title.bg_url ?? title.cover_url;
  const descLong = title.description.length > DESC_CLAMP_CHARS;
  const chaptersTotal = title.volumes.reduce((n, v) => n + v.chapters.length, 0);
  const commentsTotal = title.comments?.total ?? 0;
  const runtime = title.volumes.reduce((n, v) => n + volumeDuration(v), 0);
  const narrationStatus = sharedNarrationStatus(title.narrators);

  const restricted = title.is_restricted;

  const backdrop = (
    <div className={styles.backdrop} aria-hidden="true">
      {bg ? <img src={bg} alt="" className={styles.bdImg} /> : null}
      <div className={styles.bdVignette} />
      <div className={styles.bdNoise} />
    </div>
  );

  const modBanner =
    title.mod_status !== 'approved' ? (
      <div className={styles.modBanner} role="status">
        <ShieldAlert size={17} className={styles.modBannerIcon} />
        <p className={styles.modBannerText}>
          {title.mod_status === 'pending'
            ? 'Этот тайтл ждёт модерации — пока его видят только его чтецы и модераторы.'
            : 'Этот тайтл отклонён модерацией и скрыт из общего каталога.'}
        </p>
        <StatusBadge status={title.mod_status} />
      </div>
    ) : null;

  const coverArt = (
    <>
      {title.is_ai || title.is_nsfw ? (
        <div className={styles.coverBadges}>
          {title.is_ai ? <AiBadge /> : null}
          {title.is_nsfw ? (
            <span className={styles.nsfwBadge} title="Материал 18+">
              18+
            </span>
          ) : null}
        </div>
      ) : null}
      {title.cover_url && restricted ? (
        <div className={styles.coverLocked}>
          <img
            src={title.cover_url}
            alt=""
            aria-hidden="true"
            className={`${styles.cover} ${styles.coverBlurred}`}
          />
        </div>
      ) : title.cover_url ? (
        <PhotoView src={title.cover_url}>
          <button type="button" className={styles.coverBtn} aria-label="Увеличить обложку">
            <img src={title.cover_url} alt={`Обложка «${title.name}»`} className={styles.cover} />
          </button>
        </PhotoView>
      ) : (
        <div className={styles.coverFallback}>
          <Headphones size={44} />
        </div>
      )}
    </>
  );

  const editButtons = canEdit ? (
    <div className={styles.editBar}>
      <Link
        href={`/title/${title.slug}/edit`}
        className={styles.editBtn}
        title="Редактировать тайтл"
        aria-label="Редактировать тайтл"
      >
        <Pencil size={16} />
      </Link>
      <Link
        href={`/title/${title.slug}/edit?tab=content`}
        className={styles.editBtn}
        title="Главы и загрузка аудио"
        aria-label="Главы и загрузка аудио"
      >
        <ListMusic size={16} />
      </Link>
    </div>
  ) : null;

  const playFavActions = (
    <>
      {!restricted && resume ? (
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => void playChapter(resume.chapter)}
        >
          {player.current?.id === resume.chapter.id && player.playing ? (
            <Pause size={14} />
          ) : (
            <Play size={14} />
          )}
          {resume.continued ? 'Продолжить слушать' : 'Начать слушать'}
        </button>
      ) : null}
      {user && chaptersTotal > 0 && (
        <FavoriteButton
          titleId={title.id}
          favorited={title.my_favorite}
          count={title.favorites_count}
          compact
        />
      )}
    </>
  );

  const narratorsBlock =
    title.narrators.length > 0 ? (
      <div className={styles.narrators}>
        <span className={styles.narrLabel}>
          <Mic size={11} />
          {title.narrators.length > 1 ? `Чтецы · ${title.narrators.length}` : 'Чтец'}
        </span>
        <div className={styles.narrListH}>
          {title.narrators.map((n) => (
            <Link
              key={n.id}
              href={`/narrator/${n.slug}`}
              className={`${styles.narrItem} ${styles[STATUS_TONE[n.narration_status]]}${
                n.is_verified ? ` ${styles.narrItemVerified}` : ''
              }`}
            >
              {n.avatar_url ? (
                <img src={n.avatar_url} alt="" className={styles.narrAvatar} />
              ) : (
                <span className={styles.narrAvatarFallback}>
                  {n.name.slice(0, 1).toUpperCase()}
                </span>
              )}
              <span className={styles.narrName}>{n.name}</span>
              {n.is_verified ? (
                <VerifiedBadge size={12} className={styles.narrVerified} />
              ) : null}
            </Link>
          ))}
        </div>
      </div>
    ) : null;

  const mNarratorsBlock =
    title.narrators.length > 0 ? (
      <div className={styles.mPeople}>
        {title.narrators.map((n) => (
          <Link key={n.id} href={`/narrator/${n.slug}`} className={styles.mPerson}>
            {n.avatar_url ? (
              <img src={n.avatar_url} alt="" className={styles.mPersonAv} />
            ) : (
              <span className={styles.mPersonAvFallback}>{n.name.slice(0, 1).toUpperCase()}</span>
            )}
            <span className={styles.mPersonText}>
              <span className={styles.mPersonName}>
                {n.name}
                {n.is_verified ? <VerifiedBadge size={11} className={styles.narrVerified} /> : null}
              </span>
              <span className={styles.mPersonRole}>{'Чтец'}</span>
            </span>
          </Link>
        ))}
      </div>
    ) : null;

  const tagsBlock =
    title.genres.length > 0 ? (
      <div className={styles.tagsWrap}>
        <span className={styles.railEyebrow}>{'Теги'}</span>
        <p
          ref={tagsRef}
          className={tagsOpen || !tagsClipped ? styles.tags : `${styles.tags} ${styles.tagsClamped}`}
        >
          {title.genres.map((g) => (
            <Link key={g.slug} href={`/catalog?genre=${encodeURIComponent(g.slug)}`}>
              {g.name}
            </Link>
          ))}
        </p>
        {tagsClipped || tagsOpen ? (
          <button
            type="button"
            className={styles.tagsToggle}
            onClick={() => setTagsOpen((o) => !o)}
            aria-expanded={tagsOpen}
          >
            {tagsOpen ? 'Свернуть' : 'Показать все'}
          </button>
        ) : null}
      </div>
    ) : null;

  const descBlock = title.description ? (
    <div className={styles.descWrap}>
      <span className={styles.railEyebrow}>{'Описание'}</span>
      <div className={descLong && !descOpen ? `${styles.desc} ${styles.descClamped}` : styles.desc}>
        <Markdown source={title.description} />
      </div>
      {descLong ? (
        <button
          type="button"
          className={styles.descToggle}
          onClick={() => setDescOpen((o) => !o)}
        >
          {descOpen ? 'Свернуть' : 'Развернуть'}
        </button>
      ) : null}
    </div>
  ) : null;

  const libraryWidget = (
    <LibraryWidget
      titleId={title.id}
      entry={title.my_library}
      onChange={(e) =>
        setTitle((prev) => (prev ? { ...prev, my_library: e as TitleFull['my_library'] } : prev))
      }
      alwaysShowNote={!isMobile}
    />
  );

  const ratingCard = (
    <div className={`glass-panel ${styles.ratingCard}`}>
      <span className={styles.sideEyebrow}>
        <Star size={12} />
        {'Рейтинг'}
      </span>
      <RatingStars
        value={title.avg_rating}
        count={title.rating_count}
        my={title.my_rating}
        onRate={user ? (v) => void rate(v) : undefined}
      />
      <button
        type="button"
        className={styles.ratingToggle}
        onClick={() => setRatingOpen((o) => !o)}
        aria-expanded={ratingOpen}
      >
        {ratingOpen ? 'Свернуть распределение' : 'Показать распределение'}
        <ChevronDown
          size={14}
          className={ratingOpen ? `${styles.ratingChev} ${styles.ratingChevOpen}` : styles.ratingChev}
        />
      </button>
      <div className={ratingOpen ? `${styles.ratingBars} ${styles.ratingBarsOpen}` : styles.ratingBars}>
        <div className={styles.ratingBarsInner}>
          <RatingBars distribution={title.rating_distribution} />
        </div>
      </div>
    </div>
  );

  const banners = (
    <>
      {title.narration_pending ? (
        <div className={styles.narrationBanner}>
          <Headphones size={17} aria-hidden="true" />
          <div className={styles.narrationBannerBody}>
            <strong>Идёт ИИ-озвучка</strong>
            <span>
              Главы появляются по мере готовности — уже озвученные можно слушать, остальные в работе.
            </span>
          </div>
        </div>
      ) : null}

      {title.is_ai ? (
        <div className={styles.claimBanner}>
          <Mic size={17} aria-hidden="true" className={styles.claimBannerIcon} />
          <div className={styles.claimBannerBody}>
            <strong>Озвучиваете эту книгу?</strong>
            <span>
              Этот тайтл озвучен синтезированным голосом. Если вы чтец и озвучили
              эту книгу сами — напишите в поддержку, и мы передадим тайтл вам.
            </span>
          </div>
          <a
            href={SUPPORT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.claimBannerBtn}
          >
            Связаться с поддержкой
          </a>
        </div>
      ) : null}
    </>
  );

  const chaptersContent =
    chaptersTotal === 0 ? (
      <EmptyState
        icon={ListMusic}
        title={'Глав пока нет'}
        body={'У этой аудиокниги пока нет глав — загляните позже.'}
      />
    ) : (
      <div className={styles.volumes}>
        {title.volumes.map((v) => {
          const open = !!openVols[v.id];
          const total = volumeDuration(v);
          return (
            <div key={v.id} className={`glass-panel ${styles.volume}`}>

              <div className={styles.volHeadRow}>
                <button
                  type="button"
                  className={styles.volHead}
                  onClick={() => toggleVolume(v.id)}
                  aria-expanded={open}
                >
                  <span className={styles.volTitle}>
                    <span className={styles.volLabel}>{`Том ${v.number}`}</span>
                    {v.name ? <span className={styles.volName}>{v.name}</span> : null}
                  </span>
                  <span className={styles.volMeta}>
                    <span className={styles.volMetaItem}>
                      <ListMusic size={12} />
                      {`Глав: ${v.chapters.length}`}
                    </span>
                    {total > 0 ? (
                      <span className={styles.volMetaItem}>
                        <Clock size={12} />
                        {formatDuration(total)}
                      </span>
                    ) : null}
                  </span>
                </button>
                {user ? (
                  <ArchiveDownloadButton
                    items={archiveItems([v], false)}
                    archiveName={`${title.name} — Том ${v.number}`}
                    label={`Скачать том ${v.number} архивом`}
                    className={styles.volDownload}
                    iconOnly
                  />
                ) : null}
                <button
                  type="button"
                  className={styles.volChev}
                  onClick={() => toggleVolume(v.id)}
                  tabIndex={-1}
                  aria-hidden="true"
                >
                  <ChevronDown
                    size={16}
                    className={open ? `${styles.chev} ${styles.chevOpen}` : styles.chev}
                  />
                </button>
              </div>
              <div className={open ? `${styles.volBody} ${styles.volBodyOpen}` : styles.volBody}>
                <div className={styles.volInner}>
                  {v.chapters.length === 0 ? (
                    <div className={styles.noChapters}>
                      {'В этом томе пока нет глав.'}
                    </div>
                  ) : (
                    v.chapters.map((ch) => {
                      const isCurrent = player.current?.id === ch.id;
                      const playable = ch.audio_status === 'ready';
                      const staticPos = ch.my_position ?? 0;
                      const staticPct =
                        ch.duration_seconds > 0
                          ? Math.min(100, (staticPos / ch.duration_seconds) * 100)
                          : 0;
                      return (
                        <div
                          key={ch.id}
                          className={
                            isCurrent ? `${styles.chRow} ${styles.chRowCurrent}` : styles.chRow
                          }
                        >
                          <div className={styles.rowMain}>
                            {playable ? (
                              <button
                                type="button"
                                className={styles.playBtn}
                                onClick={() => void playChapter(ch)}
                                aria-label={
                                  isCurrent && player.playing
                                    ? `Приостановить главу ${ch.number}`
                                    : `Включить главу ${ch.number}`
                                }
                              >
                                {isCurrent && player.playing ? (
                                  <Pause size={13} />
                                ) : (
                                  <Play size={13} className={styles.playIcon} />
                                )}
                              </button>
                            ) : (
                              <span className={styles.noPlay} title={'Аудио ещё не готово'}>
                                <Headphones size={13} />
                              </span>
                            )}
                            <span className={styles.chNum}>{ch.number}</span>
                            <Link
                              href={`/chapter/${ch.id}`}
                              className={
                                isCurrent
                                  ? `${styles.chName} ${styles.chNameCurrent}`
                                  : styles.chName
                              }
                            >
                              {ch.name || `Глава ${ch.number}`}
                            </Link>
                            <span className={styles.rowRight}>
                              {(ch.narrators ?? []).length > 0 ? (
                                <span className={styles.chNarrators} title={'Чтецы главы'}>
                                  <Mic size={11} />
                                  {ch.narrators.map((n) => n.name).join(', ')}
                                </span>
                              ) : null}
                              {ch.mod_status !== 'approved' ? (
                                <StatusBadge status={ch.mod_status} />
                              ) : null}
                              {ch.audio_status !== 'ready' && (canEdit || ch.audio_status !== 'none') ? (
                                <StatusBadge status={ch.audio_status} />
                              ) : null}
                              {isMod && title.is_imported ? (
                                <button
                                  type="button"
                                  className={styles.reNarrateBtn}
                                  onClick={() => void reNarrate(ch)}
                                  disabled={reNarrating === ch.id}
                                  title={'Переозвучить главу'}
                                  aria-label={`Переозвучить главу ${ch.number}`}
                                >
                                  <RefreshCw size={12} className={reNarrating === ch.id ? styles.spin : undefined} />
                                </button>
                              ) : null}
                              {ch.duration_seconds > 0 ? (
                                <span className={styles.chDur}>
                                  {formatDuration(ch.duration_seconds)}
                                </span>
                              ) : null}
                              {playable && user ? (
                                <button
                                  type="button"
                                  className={styles.dlBtn}
                                  onClick={() => downloadChapter(ch.id)}
                                  title={'Скачать главу'}
                                  aria-label={`Скачать главу ${ch.number}`}
                                >
                                  <Download size={14} />
                                </button>
                              ) : null}
                            </span>
                          </div>
                          {isCurrent ? (
                            <ChapterProgressBar fallbackDuration={ch.duration_seconds} />
                          ) : staticPct > 0 ? (
                            <div className={styles.progress} aria-hidden="true">
                              <div
                                className={styles.progressFill}
                                style={{ width: `${staticPct}%` }}
                              />
                            </div>
                          ) : null}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );

  const commentsContent = (
    <CommentSection
      targetType="title"
      targetId={title.id}
      initialComments={title.comments}
      className={styles.commentsInTab}
    />
  );

  const similarSection =
    title.similar.length > 0 ? (
      <Section eyebrow={'В том же духе'} title={'Похожие'} accent={'тайтлы'}>
        <ScrollRail step={1}>
          {title.similar.map((s) => (
            <div key={s.id} data-rail-card>
              <TitleCardC title={s} />
            </div>
          ))}
        </ScrollRail>
      </Section>
    ) : null;

  // ---------- app-style mobile layout ----------
  if (isMobile) {
    const mobileTabs = [
      { key: 'about', label: 'О тайтле' },
      { key: 'chapters', label: 'Главы', count: chaptersTotal || undefined },
      { key: 'comments', label: 'Комментарии', count: commentsTotal || undefined },
      ...(title.similar.length > 0 ? [{ key: 'similar', label: 'Похожие' }] : []),
    ];

    return (
      <div className={styles.page}>
        {backdrop}
        {modBanner}

        <div className={styles.mHero}>
          <div className={styles.mCoverPanel}>{coverArt}</div>
          <h1 className={styles.mName}>{title.name}</h1>
          {title.alt_names.length > 0 ? (
            <p className={styles.mAlt}>{title.alt_names.join(' · ')}</p>
          ) : null}
          <div className={styles.mActions}>
            {playFavActions}
            {editButtons}
          </div>
        </div>

        {banners}

        <div className={styles.tabsRow}>
          <Tabs tabs={mobileTabs} active={mobileTab} onChange={setMobileTab} variant="underline" />
        </div>

        {mobileTab === 'about' ? (
          <div className={styles.mAbout}>
            <div className={styles.mFactsCard}>
              <div className={styles.mFacts}>
                <div className={styles.mFact}>
                  <b>Автор</b>
                  {title.author ? (
                    <Link href={`/author/${title.author.id}`}>{title.author.name}</Link>
                  ) : (
                    <span className={styles.quickMuted}>не указан</span>
                  )}
                </div>
                {title.narrators.length > 0 ? (
                  <div className={styles.mFact}>
                    <b>Озвучка</b>
                    <span>{narrationStatus ? NARRATION_STATUS_LABELS[narrationStatus] : 'Разная'}</span>
                  </div>
                ) : null}
                {runtime > 0 ? (
                  <div className={styles.mFact}>
                    <b>Длительность</b>
                    <span>{formatDuration(runtime)}</span>
                  </div>
                ) : null}
                <div className={styles.mFact}>
                  <b>Просмотров</b>
                  <span>{formatCount(title.views_count)}</span>
                </div>
              </div>
            </div>

            {mNarratorsBlock}
            {descBlock}
            {tagsBlock}
            {ratingCard}
            {libraryWidget}
          </div>
        ) : null}

        {mobileTab === 'chapters' ? (
          <section className={styles.tabPanel}>{chaptersContent}</section>
        ) : null}

        {mobileTab === 'comments' ? (
          <section className={styles.tabPanel}>{commentsContent}</section>
        ) : null}

        {mobileTab === 'similar' && title.similar.length > 0 ? (
          <div className={styles.mSimilar}>
            {title.similar.map((s) => (
              <TitleCardC key={s.id} title={s} />
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  // ---------- desktop layout ----------
  return (
    <div className={styles.page}>
      {backdrop}
      {modBanner}

      <header className={styles.hero}>
        <div className={styles.top}>
          <div className={styles.coverCol}>
            <div className={styles.coverPanel}>{coverArt}</div>
          </div>

          <div className={styles.headinfo}>
            <div className={styles.titleRow}>
              <div className={styles.nameBlock}>
                <h1 className={styles.name}>{title.name}</h1>
                {title.alt_names.length > 0 ? (
                  <p className={styles.altNames}>{title.alt_names.join(' · ')}</p>
                ) : null}
              </div>
              {editButtons}
            </div>

            <div className={styles.actions}>{playFavActions}</div>

            {tagsBlock}
            {descBlock}
          </div>
        </div>

        {title.narration_pending || title.is_ai ? (
          <div className={styles.heroBanners}>{banners}</div>
        ) : null}

        <div className={styles.subrow}>
          <div className={`glass-panel ${styles.factsCard} ${styles.factsCardCol}`}>
            <span className={styles.sideEyebrow}>
              <Info size={12} />
              {'Информация'}
            </span>
            <div className={styles.factsCardBody}>
              {title.author && (
                <div className={styles.factRow2}>
                  <span className={styles.factK}>{'Автор'}</span>
                  <Link
                    href={`/author/${title.author.id}`}
                    className={styles.factV}
                    title={`Ещё от ${title.author.name}`}
                  >
                    {title.author.name}
                  </Link>
                </div>
              )}
              <div className={styles.factRow2}>
                <span className={styles.factK}>{'Тайтл'}</span>
                <span className={styles.factV}>
                  {RELEASE_STATUS_LABELS[title.release_status] ?? title.release_status}
                </span>
              </div>
              {title.narrators.length > 0 ? (
                <div className={styles.factRow2}>
                  <span className={styles.factK}>{'Озвучка'}</span>
                  <span className={styles.factV}>
                    {narrationStatus ? NARRATION_STATUS_LABELS[narrationStatus] : 'Разная'}
                  </span>
                </div>
              ) : null}
              {title.year != null ? (
                <div className={styles.factRow2}>
                  <span className={styles.factK}>{'Год'}</span>
                  <span className={styles.factV}>{title.year}</span>
                </div>
              ) : null}
              {runtime > 0 ? (
                <div className={styles.factRow2}>
                  <span className={styles.factK}>{'Длительность'}</span>
                  <span className={styles.factV}>{formatDuration(runtime)}</span>
                </div>
              ) : null}
              {chaptersTotal > 0 ? (
                <div className={styles.factRow2}>
                  <span className={styles.factK}>{'Глав'}</span>
                  <span className={styles.factV}>{chaptersTotal}</span>
                </div>
              ) : null}
              <div className={styles.factRow2}>
                <span className={styles.factK}>{'Просмотров'}</span>
                <span className={styles.factV}>{formatCount(title.views_count)}</span>
              </div>
              {narratorsBlock}
            </div>
          </div>
          {libraryWidget}
          {ratingCard}
        </div>
      </header>

      {similarSection}

      <div className={styles.tabsRow}>
        <Tabs
          tabs={[
            { key: 'chapters', label: 'Тома и главы', count: chaptersTotal || undefined },
            { key: 'comments', label: 'Комментарии', count: commentsTotal || undefined },
          ]}
          active={tab}
          onChange={setTab}
          urlParam="tab"
          variant="underline"
        />
      </div>

      {tab === 'chapters' ? (
        <section className={styles.tabPanel}>{chaptersContent}</section>
      ) : (
        <section className={styles.tabPanel}>{commentsContent}</section>
      )}
    </div>
  );
}
