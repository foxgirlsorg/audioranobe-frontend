'use client';

import Link from 'next/link';
import { Star, Headphones, Trash2 } from 'lucide-react';
import type { TitleCard } from '@/lib/types';
import { useAuth } from '@/lib/auth';
import styles from './TitleCardC.module.css';

export function TitleCardC({ title }: { title: TitleCard }) {
  const { user: me } = useAuth();
  const isAdmin = me?.role === 'admin';
  const avg =
    title.avg_rating != null && !Number.isNaN(Number(title.avg_rating))
      ? Number(title.avg_rating).toFixed(1)
      : null;
  const genres = (title.genres ?? []).slice(0, 3);
  // Signed-out visitors see gated titles listed, but with the cover blurred.
  const blurred = title.is_restricted;

  return (
    <Link href={`/title/${title.slug}`} className={styles.card}>
      <div className={styles.coverWrap}>
        {title.cover_url ? (
          <img
            src={title.cover_url}
            alt={title.name}
            className={blurred ? `${styles.cover} ${styles.blurred}` : styles.cover}
            loading="lazy"
          />
        ) : (
          <div className={styles.coverFallback}>
            <Headphones size={30} />
          </div>
        )}
        {title.is_nsfw ? (
          <span className={styles.nsfwBadge} title="Материал 18+">
            18+
          </span>
        ) : null}
        {title.is_deleted && isAdmin ? (
          <span className={styles.deletedBadge} title="Удалён">
            <Trash2 size={12} />
          </span>
        ) : null}
        <span
          className={styles.ratingBadge}
          title={avg ? `Оценка ${avg}` : 'Оценок пока нет'}
        >
          <Star size={11} className={styles.star} />
          {avg ?? '—'}
        </span>
        {genres.length > 0 ? (
          <div className={styles.genres} aria-hidden="true">
            {genres.map((g) => (
              <span key={g.slug} className={styles.genre}>
                {g.name}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      <div className={styles.name}>{title.name}</div>
      {title.author ? <div className={styles.author}>{title.author.name}</div> : null}
    </Link>
  );
}

export default TitleCardC;
