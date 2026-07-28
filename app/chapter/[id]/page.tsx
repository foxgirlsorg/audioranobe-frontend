'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Headphones,
  History,
  Pause,
  Play,
  RefreshCw,
  Search,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import type { ChapterPlay } from '@/lib/types';
import { usePlayer } from '@/lib/player';
import { useToast, errMsg } from '@/lib/toast';
import { formatDuration } from '@/lib/format';
import Spinner from '@/components/Spinner';
import EmptyState from '@/components/EmptyState';
import styles from './page.module.css';

export default function ChapterPage({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  const validId = Number.isInteger(id) && id > 0;

  const router = useRouter();
  const player = usePlayer();
  const { toast } = useToast();

  const [chapter, setChapter] = useState<ChapterPlay | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

  const load = useCallback(async () => {
    if (!validId) {
      setMissing(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setMissing(false);
    setChapter(null);
    try {
      const c = await api<ChapterPlay>(`/chapters/${id}`);
      setChapter(c);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        setMissing(true);
      } else {
        setError(errMsg(e));
      }
    } finally {
      setLoading(false);
    }
  }, [id, validId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (chapter) {
      document.title = `${chapter.number}. ${chapter.name || 'Глава'} — ${chapter.title.name} — AudioRanobe`;
    }
  }, [chapter]);

  async function onPlayPause() {
    if (!chapter) return;
    if (player.current?.id === chapter.id) {
      player.toggle();
      return;
    }
    try {
      await player.playChapter(chapter.id);
    } catch (e) {
      toast(errMsg(e), 'error');
    }
  }

  if (loading) {
    return (
      <div className={styles.loadingWrap}>
        <Spinner size={34} />
      </div>
    );
  }

  if (missing) {
    return (
      <div className={styles.errCard + ' glass-panel'}>
        <div className={styles.errIcon}>
          <Headphones size={34} />
        </div>
        <h1 className={styles.errTitle}>{'Глава недоступна'}</h1>
        <p className={styles.errBody}>
          {'Этой главы не существует, её аудио ещё не готово или она всё ещё ждёт модерации. Попробуйте чуть позже.'}
        </p>
        <div className={styles.errActions}>
          <button type="button" className="btn btn-ghost" onClick={() => router.back()}>
            <ChevronLeft size={14} />
            {'Назад'}
          </button>
          <Link href="/catalog" className="btn btn-primary">
            <Search size={14} />
            {'В каталог'}
          </Link>
        </div>
      </div>
    );
  }

  if (error || !chapter) {
    return (
      <div className={styles.errorWrap}>
        <EmptyState
          icon={Headphones}
          title={'Не удалось загрузить главу'}
          body={error ?? 'Что-то пошло не так.'}
        />
        <button type="button" className="btn" onClick={() => void load()}>
          <RefreshCw size={14} />
          {'Попробовать ещё раз'}
        </button>
      </div>
    );
  }

  const isCurrent = player.current?.id === chapter.id;
  const playing = isCurrent && player.playing;
  const livePos = isCurrent ? player.position : chapter.my_position ?? 0;
  const dur = isCurrent && player.duration > 0 ? player.duration : chapter.duration_seconds;
  const pct = dur > 0 ? Math.min(100, (livePos / dur) * 100) : 0;
  const chapterLabel = chapter.name || `Глава ${chapter.number}`;
  const volumeLabel = chapter.volume.name
    ? `Том ${chapter.volume.number} — ${chapter.volume.name}`
    : `Том ${chapter.volume.number}`;

  return (
    <div className={styles.page}>
      {/* Blurred cover backdrop: media → vignette → grain (STYLE.md 4.2) */}
      <div className={styles.backdrop} aria-hidden="true">
        {chapter.title.cover_url ? (
          <img src={chapter.title.cover_url} alt="" className={styles.bdImg} />
        ) : null}
        <div className={styles.bdVignette} />
        <div className={styles.bdNoise} />
      </div>

      <nav className={styles.breadcrumb} aria-label={'Хлебные крошки'}>
        <Link href={`/title/${chapter.title.slug}`} className={styles.crumbLink}>
          {chapter.title.name}
        </Link>
        <span className={styles.crumbSep}>/</span>
        <span className={styles.crumbPart}>{volumeLabel}</span>
        <span className={styles.crumbSep}>/</span>
        <span className={styles.crumbCurrent}>
          {chapter.number}. {chapterLabel}
        </span>
      </nav>

      <section className={`glass-panel ${styles.hero}`}>
        <span className={`glow ${styles.heroGlow}`} aria-hidden="true" />

        <Link
          href={`/title/${chapter.title.slug}`}
          className={styles.coverThumb}
          title={chapter.title.name}
        >
          {chapter.title.cover_url ? (
            <img
              src={chapter.title.cover_url}
              alt={`Обложка «${chapter.title.name}»`}
            />
          ) : (
            <span className={styles.coverFallback}>
              <Headphones size={22} />
            </span>
          )}
        </Link>

        <span className="eyebrow">
          {volumeLabel} · {`Глава ${chapter.number}`}
        </span>
        <h1 className={styles.name}>{chapterLabel}</h1>

        <button
          type="button"
          className={playing ? `${styles.bigPlay} ${styles.bigPlayActive}` : styles.bigPlay}
          onClick={() => void onPlayPause()}
          aria-label={playing ? 'Пауза' : 'Воспроизвести'}
        >
          {playing ? <Pause size={30} /> : <Play size={30} className={styles.bigPlayIcon} />}
        </button>
        <span className={styles.playState}>
          {playing ? 'Играет' : isCurrent ? 'На паузе' : 'Слушать главу'}
        </span>

        <div className={styles.progressWrap}>
          <div className={styles.progress} aria-hidden="true">
            <div className={styles.progressFill} style={{ width: `${pct}%` }} />
          </div>
          <div className={styles.times}>
            <span>{formatDuration(livePos)}</span>
            <span>{formatDuration(dur)}</span>
          </div>
        </div>

        <div className={styles.metaRow}>
          <span className={styles.chip} title={'Длительность'}>
            <Clock size={12} />
            {formatDuration(chapter.duration_seconds)}
          </span>
          {!isCurrent && chapter.my_position != null && chapter.my_position > 0 ? (
            <span className={styles.chip} title={'Сохранённая позиция'}>
              <History size={12} />
              {`Остановились на ${formatDuration(chapter.my_position)}`}
            </span>
          ) : null}
          <a
            href={chapter.audio_url}
            download={`${chapter.title.name} — ${chapter.number}. ${chapterLabel}.opus`}
            className={styles.chipLink}
            title={'Скачать аудио'}
          >
            <Download size={12} />
            {'Скачать'}
          </a>
        </div>

        <div className={styles.pager}>
          {chapter.prev_id != null ? (
            <Link href={`/chapter/${chapter.prev_id}`} className={`btn ${styles.pagerBtn}`}>
              <ChevronLeft size={14} />
              {'Предыдущая'}
            </Link>
          ) : (
            <span className={`btn ${styles.pagerBtn} ${styles.pagerDisabled}`} aria-disabled="true">
              <ChevronLeft size={14} />
              {'Предыдущая'}
            </span>
          )}
          {chapter.next_id != null ? (
            <Link href={`/chapter/${chapter.next_id}`} className={`btn ${styles.pagerBtn}`}>
              {'Следующая'}
              <ChevronRight size={14} />
            </Link>
          ) : (
            <span className={`btn ${styles.pagerBtn} ${styles.pagerDisabled}`} aria-disabled="true">
              {'Следующая'}
              <ChevronRight size={14} />
            </span>
          )}
        </div>
      </section>

    </div>
  );
}
