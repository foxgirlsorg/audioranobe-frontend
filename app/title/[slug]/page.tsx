'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
  ListMusic,
  Lock,
  Mic,
  Pencil,
  Pause,
  Play,
  RefreshCw,
  ShieldAlert,
  Star,
} from 'lucide-react';
import { api, API_URL, ApiError } from '@/lib/api';
import {
  NARRATION_STATUS_LABELS,
  RELEASE_STATUS_LABELS,
  type ChapterPlay,
  type ChapterRow,
  type TitleFull,
  type Volume,
} from '@/lib/types';
import { useAuth } from '@/lib/auth';
import { usePlayer } from '@/lib/player';
import { useToast, errMsg } from '@/lib/toast';
import { formatCount, formatDuration } from '@/lib/format';
import Section from '@/components/Section';
import CardGrid from '@/components/CardGrid';
import TitleCardC from '@/components/TitleCardC';
import RatingStars from '@/components/RatingStars';
import RatingBars from '@/components/RatingBars';
import CommentSection from '@/components/CommentSection';
import LibraryWidget from '@/components/LibraryWidget';
import FavoriteButton from '@/components/FavoriteButton';
import StatusBadge from '@/components/StatusBadge';
import Spinner from '@/components/Spinner';
import EmptyState from '@/components/EmptyState';
import ImageViewer from '@/components/ImageViewer';
import Markdown from '@/components/Markdown';
import ArchiveDownloadButton, { type ArchiveItem } from '@/components/ArchiveDownloadButton';
import styles from './page.module.css';

const DESC_CLAMP_CHARS = 420;

function volumeDuration(v: Volume): number {
  return v.chapters.reduce((sum, c) => sum + (c.duration_seconds || 0), 0);
}

export default function TitlePage({ params }: { params: { slug: string } }) {
  const slug = decodeURIComponent(params.slug);
  const { user, isMod } = useAuth();
  const player = usePlayer();
  const { toast } = useToast();

  const [title, setTitle] = useState<TitleFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [openVols, setOpenVols] = useState<Record<number, boolean>>({});
  const [descOpen, setDescOpen] = useState(false);
  const [coverOpen, setCoverOpen] = useState(false);
  const [canEdit, setCanEdit] = useState(false);

  useEffect(() => {
    if (title) setCanEdit(title.can_edit);
  }, [title]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const full = await api<TitleFull>(`/titles/${encodeURIComponent(slug)}`);
      setTitle(full);
      // open the first volume (prefer the first one that actually has chapters)
      const first = full.volumes.find((v) => v.chapters.length > 0) ?? full.volumes[0];
      setOpenVols(first ? { [first.id]: true } : {});
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
    void load();
  }, [load]);

  useEffect(() => {
    if (title) document.title = `${title.name} — AudioRanobe`;
  }, [title]);

  // Chapters in listening order that can actually be played right now.
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

  // "Start / Continue listening" target: the last chapter with saved progress
  // (rolling over to the next one when it is basically finished), else chapter one.
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

  /**
   * A single chapter is a plain link: the endpoint is public and sends its own
   * Content-Disposition, so the browser owns the transfer. Multi-file downloads
   * go through ArchiveDownloadButton, which zips them client-side.
   */
  function downloadChapter(chapterId: number) {
    const a = document.createElement('a');
    a.href = `${API_URL}/download/chapters/${chapterId}`;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  /** Chapters worth archiving, named the way the server names a single file. */
  function archiveItems(volumes: Volume[], foldered: boolean): ArchiveItem[] {
    const out: ArchiveItem[] = [];
    for (const v of volumes) {
      for (const c of v.chapters) {
        if (c.audio_status !== 'ready') continue;
        const label = c.name || `Глава ${c.number}`;
        out.push({
          id: c.id,
          name: `${String(c.number).padStart(3, '0')}. ${label}.opus`,
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
    return (
      <div className={styles.loadingWrap}>
        <Spinner size={34} />
      </div>
    );
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
  // Gated (18+ or sensitive genre) and the viewer is signed out: the page stays
  // browsable, but the cover is blurred, the viewer is off and nothing plays.
  const restricted = title.is_restricted;

  return (
    <div className={styles.page}>
      {/* Full-bleed blurred backdrop: media → vignette → grain (STYLE.md 4.2) */}
      <div className={styles.backdrop} aria-hidden="true">
        {bg ? <img src={bg} alt="" className={styles.bdImg} /> : null}
        <div className={styles.bdVignette} />
        <div className={styles.bdNoise} />
      </div>

      {title.mod_status !== 'approved' ? (
        <div className={styles.modBanner} role="status">
          <ShieldAlert size={17} className={styles.modBannerIcon} />
          <p className={styles.modBannerText}>
            {title.mod_status === 'pending'
              ? 'Этот тайтл ждёт модерации — пока его видят только его чтецы и модераторы.'
              : 'Этот тайтл отклонён модерацией и скрыт из общего каталога.'}
          </p>
          <StatusBadge status={title.mod_status} />
        </div>
      ) : null}

      <header className={styles.hero}>
        <div className={styles.coverCol}>
          <div className={styles.coverPanel}>
            {title.cover_url && restricted ? (
              <div className={styles.coverLocked}>
                <img
                  src={title.cover_url}
                  alt=""
                  aria-hidden="true"
                  className={`${styles.cover} ${styles.coverBlurred}`}
                />
                <span className={styles.coverLockLabel}>
                  <Lock size={16} />
                  {'Только для зарегистрированных'}
                </span>
              </div>
            ) : title.cover_url ? (
              <button
                type="button"
                className={styles.coverBtn}
                onClick={() => setCoverOpen(true)}
                aria-label="Увеличить обложку"
              >
                <img
                  src={title.cover_url}
                  alt={`Обложка «${title.name}»`}
                  className={styles.cover}
                />
              </button>
            ) : (
              <div className={styles.coverFallback}>
                <Headphones size={40} />
              </div>
            )}
          </div>
        </div>

        <div className={styles.infoCol}>
          <span className="eyebrow">{'Аудиокнига'}</span>
          <div className={styles.nameRow}>
            <h1 className={styles.name}>{title.name}</h1>
            {title.is_nsfw ? (
              <span className={styles.nsfwBadge} title="Материал 18+">
                18+
              </span>
            ) : null}
            {canEdit ? (
              <>
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
              </>
            ) : null}
          </div>
          {title.alt_names.length > 0 ? (
            <p className={styles.altNames}>{title.alt_names.join(' · ')}</p>
          ) : null}
          {title.author ? (
            <Link
              href={`/author/${title.author.id}`}
              className={styles.author}
              title={`Ещё от ${title.author.name}`}
            >
              {title.author.name}
            </Link>
          ) : null}

          <div className={styles.metaChips}>
            {title.year != null ? (
              <span className={styles.chip} title={'Год'}>
                <Calendar size={12} />
                {title.year}
              </span>
            ) : null}
            <span className={styles.chip} title={'Статус тайтла'}>
              <Disc3 size={12} />
              {RELEASE_STATUS_LABELS[title.release_status] ?? title.release_status}
            </span>
            <span className={styles.chip} title={'Прослушивания'}>
              <Headphones size={12} />
              {formatCount(title.listens)}
            </span>
            <span className={styles.chip} title={'Просмотров'}>
              <Eye size={12} />
              {formatCount(title.views_count)}
            </span>
          </div>

          {title.genres.length > 0 ? (
            <div className={styles.genres}>
              {title.genres.map((g) => (
                <Link key={g.slug} href={`/catalog?genre=${encodeURIComponent(g.slug)}`} className="pill">
                  {g.name}
                </Link>
              ))}
            </div>
          ) : null}

          {title.narrators.length > 0 ? (
            <div className={styles.narrators}>
              <span className={styles.narrLabel}>
                <Mic size={11} />
                {'Озвучка'}
              </span>
              <div className={styles.narrList}>
                {title.narrators.map((n) => (
                  <Link key={n.id} href={`/narrator/${n.slug}`} className={styles.narrItem}>
                    {n.avatar_url ? (
                      <img src={n.avatar_url} alt="" className={styles.narrAvatar} />
                    ) : (
                      <span className={styles.narrAvatarFallback}>
                        {n.name.slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    <span className={styles.narrName}>{n.name}</span>
                    <span className={styles.narrStatus}>
                      {NARRATION_STATUS_LABELS[n.narration_status] ?? ''}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}

          {title.description ? (
            <div className={styles.descWrap}>
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
          ) : null}

          {restricted ? (
            <div className={styles.restrictedNotice} role="status">
              <Lock size={15} />
              <span>
                {title.is_nsfw
                  ? 'Этот тайтл помечен 18+. Войдите в аккаунт, чтобы слушать его и увидеть обложку.'
                  : 'Этот тайтл содержит чувствительные теги. Войдите в аккаунт, чтобы слушать его и увидеть обложку.'}
              </span>
              <Link href="/auth/login" className="btn btn-primary">
                {'Войти'}
              </Link>
            </div>
          ) : resume ? (
            <div className={styles.actions}>
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
              {user ? (
                <ArchiveDownloadButton
                  items={archiveItems(title.volumes, title.volumes.length > 1)}
                  archiveName={title.name}
                  title="Скачать все главы одним архивом"
                />
              ) : null}
            </div>
          ) : null}
        </div>

        <aside className={styles.sideCol}>
          <div className={styles.favRow}>
            <FavoriteButton
              titleId={title.id}
              favorited={title.my_favorite}
              count={title.favorites_count}
            />
          </div>
          <LibraryWidget
            titleId={title.id}
            entry={title.my_library}
            onChange={(e) =>
              setTitle((prev) =>
                prev ? { ...prev, my_library: e as TitleFull['my_library'] } : prev
              )
            }
          />
          <div className={`glass-panel ${styles.ratingPanel}`}>
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
            <RatingBars distribution={title.rating_distribution} />
          </div>
        </aside>
      </header>

      <Section eyebrow={'Слушать'} title={'Тома и'} accent={'главы'}>
        {chaptersTotal === 0 ? (
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
                        {v.chapters.length === 1
                          ? `Глав: ${v.chapters.length}`
                          : `Глав: ${v.chapters.length}`}
                      </span>
                      {total > 0 ? (
                        <span className={styles.volMetaItem}>
                          <Clock size={12} />
                          {formatDuration(total)}
                        </span>
                      ) : null}
                      <ChevronDown
                        size={16}
                        className={open ? `${styles.chev} ${styles.chevOpen}` : styles.chev}
                      />
                    </span>
                  </button>
                  {user ? (
                    <span className={styles.volDownloadRow}>
                      <ArchiveDownloadButton
                        items={archiveItems([v], false)}
                        archiveName={`${title.name} — Том ${v.number}`}
                        label="Скачать том"
                        className={styles.volDownload}
                        title="Скачать том архивом"
                      />
                    </span>
                  ) : null}
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
                          const pos = isCurrent ? player.position : ch.my_position ?? 0;
                          const dur =
                            isCurrent && player.duration > 0
                              ? player.duration
                              : ch.duration_seconds;
                          const pct = dur > 0 ? Math.min(100, (pos / dur) * 100) : 0;
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
                                  {ch.audio_status !== 'ready' ? (
                                    <StatusBadge status={ch.audio_status} />
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
                              {pct > 0 ? (
                                <div className={styles.progress} aria-hidden="true">
                                  <div
                                    className={styles.progressFill}
                                    style={{ width: `${pct}%` }}
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
        )}
      </Section>

      {title.similar.length > 0 ? (
        <Section eyebrow={'В том же духе'} title={'Похожие'} accent={'тайтлы'}>
          <CardGrid>
            {title.similar.map((s) => (
              <TitleCardC key={s.id} title={s} />
            ))}
          </CardGrid>
        </Section>
      ) : null}

      <div className={styles.comments}>
        <CommentSection targetType="title" targetId={title.id} />
      </div>

      <ImageViewer
        src={title.cover_url}
        alt={`Обложка «${title.name}»`}
        open={coverOpen && !restricted}
        onClose={() => setCoverOpen(false)}
      />
    </div>
  );
}
