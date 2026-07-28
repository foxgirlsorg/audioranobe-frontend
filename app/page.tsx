'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Compass, Megaphone, Play, UserPlus, X } from 'lucide-react';
import { api } from '@/lib/api';
import type { HomeData, TitleCard } from '@/lib/types';
import { useAuth } from '@/lib/auth';
import { usePlayer } from '@/lib/player';
import { errMsg, useToast } from '@/lib/toast';
import { formatDate, formatDuration } from '@/lib/format';
import Section from '@/components/Section';
import TitleCardC from '@/components/TitleCardC';
import Spinner from '@/components/Spinner';
import EmptyState from '@/components/EmptyState';
import styles from './page.module.css';

const SEEN_KEY = 'audioranobe_seen_announcements';

function readSeenIds(): number[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(SEEN_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((n): n is number => typeof n === 'number') : [];
  } catch {
    return [];
  }
}

function writeSeenIds(ids: number[]): void {
  try {
    window.localStorage.setItem(SEEN_KEY, JSON.stringify(ids.slice(-200)));
  } catch {
    // storage unavailable — dismissal lasts for this session only
  }
}

function TitleRail({ titles }: { titles: TitleCard[] }) {
  if (titles.length === 0) {
    return <p className={styles.railEmpty}>Здесь пока пусто.</p>;
  }
  return (
    <div className={styles.rail}>
      {titles.map((t) => (
        <div key={t.id} className={styles.railItem}>
          <TitleCardC title={t} />
        </div>
      ))}
    </div>
  );
}

export default function HomePage() {
  const { user, loading: authLoading } = useAuth();
  const { playChapter } = usePlayer();
  const { toast } = useToast();

  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seen, setSeen] = useState<number[]>([]);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    setSeen(readSeenIds());
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    api<HomeData>('/home')
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
  }, [nonce]);

  const dismiss = (id: number) => {
    setSeen((prev) => {
      const next = [...prev.filter((x) => x !== id), id];
      writeSeenIds(next);
      return next;
    });
  };

  const resume = async (chapterId: number) => {
    try {
      await playChapter(chapterId);
    } catch (e) {
      toast(errMsg(e), 'error');
    }
  };

  if (loading) {
    return (
      <div className={styles.center}>
        <Spinner size={34} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={styles.center}>
        <EmptyState
          icon={AlertTriangle}
          title="Не удалось загрузить главную"
          body={error ?? 'Что-то пошло не так.'}
        />
        <button type="button" className="btn" onClick={() => setNonce((n) => n + 1)}>
          Попробовать ещё раз
        </button>
      </div>
    );
  }

  const visibleAnnouncements = data.announcements.filter((a) => !seen.includes(a.id));

  return (
    <div className={styles.page}>
      {!authLoading && !user ? (
        <section className={styles.hero}>
          <span className={`glow ${styles.glowA}`} aria-hidden="true" />
          <span className={`glow ${styles.glowB}`} aria-hidden="true" />
          <div className="eyebrow">Аудиокниги от сообщества</div>
          <h1 className={styles.heroTitle}>
            Истории, которые <span>оживают в звуке</span>
          </h1>
          <p className={styles.heroTagline}>
            AudioRanobe — дом для аудиокниг в озвучке сообщества. Подписывайтесь на любимых чтецов,
            собирайте свою библиотеку и продолжайте каждую историю ровно с того места, где
            остановились.
          </p>
          <div className={styles.heroActions}>
            <Link href="/catalog" className="btn btn-primary">
              <Compass />
              Открыть каталог
            </Link>
            <Link href="/auth/register" className="btn">
              <UserPlus />
              Создать аккаунт
            </Link>
          </div>
        </section>
      ) : null}

      {visibleAnnouncements.length > 0 ? (
        <div className={styles.annStrip}>
          {visibleAnnouncements.map((a) => (
            <div key={a.id} className={styles.annCard}>
              <span className={styles.annIcon}>
                <Megaphone size={16} />
              </span>
              <div className={styles.annBody}>
                <span className={styles.annDate}>{formatDate(a.created_at)}</span>
                <Link href={`/news/${a.slug}`} className={styles.annTitle}>
                  {a.title}
                </Link>
                {a.body ? <p className={styles.annText}>{a.body}</p> : null}
              </div>
              <button
                type="button"
                className={styles.annDismiss}
                onClick={() => dismiss(a.id)}
                aria-label="Скрыть объявление"
              >
                <X size={15} />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {data.continue.length > 0 ? (
        <Section
          eyebrow="Вернитесь к тому, на чём остановились"
          title="Продолжить"
          accent="слушать"
        >
          <div className={styles.rail}>
            {data.continue.map((c) => {
              const pct =
                c.chapter.duration_seconds > 0
                  ? Math.min(100, (c.position_seconds / c.chapter.duration_seconds) * 100)
                  : 0;
              return (
                <div key={c.chapter.id} className={styles.continueCard}>
                  <Link href={`/title/${c.title.slug}`} className={styles.continueCover}>
                    {c.title.cover_url ? (
                      <img src={c.title.cover_url} alt={c.title.name} loading="lazy" />
                    ) : (
                      <span className={styles.coverFallback}>
                        <Play size={18} />
                      </span>
                    )}
                  </Link>
                  <div className={styles.continueInfo}>
                    <Link href={`/title/${c.title.slug}`} className={styles.continueName}>
                      {c.title.name}
                    </Link>
                    <div className={styles.continueChapter}>
                      {`Гл. ${c.chapter.number}`}
                      {c.chapter.name ? ` — ${c.chapter.name}` : ''}
                    </div>
                    <div className={styles.progressTrack} aria-hidden="true">
                      <span className={styles.progressFill} style={{ width: `${pct}%` }} />
                    </div>
                    <div className={styles.continueFoot}>
                      <span className={styles.continueTime}>
                        {formatDuration(c.position_seconds)} /{' '}
                        {formatDuration(c.chapter.duration_seconds)}
                      </span>
                      <button
                        type="button"
                        className={styles.resumeBtn}
                        onClick={() => resume(c.chapter.id)}
                      >
                        <Play size={13} />
                        Продолжить
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      ) : null}

      <Section eyebrow="Свежее на полке" title="Новые" accent="тайтлы">
        <TitleRail titles={data.new_titles} />
      </Section>

      <Section eyebrow="Что слушают все" title="Популярное" accent="сейчас">
        <TitleRail titles={data.popular} />
      </Section>

      <Section eyebrow="Лучшее по оценкам слушателей" title="Топ" accent="по оценкам">
        <TitleRail titles={data.top_rated} />
      </Section>

      <Section eyebrow="Только что вышли новые главы" title="Недавно" accent="обновлено">
        <TitleRail titles={data.recently_updated} />
      </Section>
    </div>
  );
}
