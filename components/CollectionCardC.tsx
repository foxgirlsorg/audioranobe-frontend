'use client';

import Link from 'next/link';
import { Heart, Library, Lock } from 'lucide-react';
import type { CollectionCard } from '@/lib/types';
import styles from './CollectionCardC.module.css';

const FAN_CLASSES = ['c0', 'c1', 'c2'] as const;

export function CollectionCardC({ collection }: { collection: CollectionCard }) {
  const covers = (collection.cover_urls ?? []).slice(0, 3);

  return (
    <Link href={`/collections/${collection.id}`} className={styles.card}>
      <div className={styles.covers}>
        {covers.length > 0 ? (
          covers.map((url, i) => (
            <img
              key={`${url}-${i}`}
              src={url}
              alt=""
              className={`${styles.coverImg} ${styles[FAN_CLASSES[i]]}`}
              loading="lazy"
            />
          ))
        ) : (
          <span className={styles.coversEmpty}>
            <Library size={26} />
          </span>
        )}
      </div>
      <div className={styles.nameRow}>
        <span className={styles.name}>{collection.name}</span>
        {!collection.is_public ? (
          <span className={styles.private}>
            <Lock size={9} />
            {'Приватная'}
          </span>
        ) : null}
      </div>
      {collection.description ? (
        <p className={styles.desc}>{collection.description}</p>
      ) : null}
      <div className={styles.meta}>
        <span className={styles.by}>
          {`от ${collection.user.username}`}
        </span>
        <span className={styles.stats}>
          <span className={styles.stat}>
            <Library size={12} />
            {collection.items_count}
          </span>
          <span className={styles.stat}>
            <Heart size={12} />
            {collection.likes_count}
          </span>
        </span>
      </div>
    </Link>
  );
}

export default CollectionCardC;
