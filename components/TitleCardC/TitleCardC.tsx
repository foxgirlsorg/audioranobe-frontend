'use client';

import Link from 'next/link';
import { Star, Headphones, Trash2 } from 'lucide-react';
import type { TitleCard } from '@/lib/types';
import { useAuth } from '@/lib/auth';
import AiBadge from '@/components/AiBadge/AiBadge';
import styles from './TitleCardC.module.css';

export function TitleCardC({ title }: { title: TitleCard }) {
  const { user: me, can } = useAuth();
  const isAdmin = can('titles.edit');
  const avg =
    title.avg_rating != null && !Number.isNaN(Number(title.avg_rating))
      ? Number(title.avg_rating).toFixed(1)
      : null;
  const blurred = title.is_restricted;

  return (
    <Link href={`/title/${title.slug}`} className={styles.card}>
      <div className={styles.coverWrap}>
        {title.cover_thumb_url || title.cover_url ? (
          <img
            src={title.cover_thumb_url || title.cover_url || ''}
            alt={title.name}
            className={blurred ? `${styles.cover} ${styles.blurred}` : styles.cover}
            loading="lazy"
          />
        ) : (
          <div className={styles.coverFallback}>
            <Headphones size={30} />
          </div>
        )}
        <div className={styles.badges}>
          {title.is_deleted && isAdmin ? (
            <span className={styles.deletedBadge} title="Удалён">
              <Trash2 size={12} />
            </span>
          ) : null}
          {title.is_ai ? <AiBadge /> : null}
          {title.is_nsfw ? (
            <span className={styles.nsfwBadge} title="Материал 18+">
              18+
            </span>
          ) : null}
        </div>
        <span
          className={styles.ratingBadge}
          title={avg ? `Оценка ${avg}` : 'Оценок пока нет'}
        >
          <Star size={11} className={styles.star} />
          {avg ?? '—'}
        </span>
      </div>
      <div className={styles.name}>{title.name}</div>
      {title.author ? <div className={styles.author}>{title.author.name}</div> : null}
    </Link>
  );
}

export default TitleCardC;
