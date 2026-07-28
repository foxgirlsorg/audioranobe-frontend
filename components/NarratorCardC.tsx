'use client';

import Link from 'next/link';
import { Mic } from 'lucide-react';
import type { NarratorCard } from '@/lib/types';
import styles from './NarratorCardC.module.css';

export function NarratorCardC({ narrator }: { narrator: NarratorCard }) {
  return (
    <Link href={`/narrator/${narrator.slug}`} className={styles.card}>
      <div className={styles.avatarWrap}>
        {narrator.avatar_url ? (
          <img
            src={narrator.avatar_url}
            alt={narrator.name}
            className={styles.avatar}
            loading="lazy"
          />
        ) : (
          <span className={styles.fallback}>
            <Mic size={26} />
          </span>
        )}
      </div>
      <div className={styles.name}>{narrator.name}</div>
      <div className={styles.count}>
        {`Тайтлов: ${narrator.titles_count}`}
      </div>
    </Link>
  );
}

export default NarratorCardC;
