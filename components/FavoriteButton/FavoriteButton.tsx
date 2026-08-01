'use client';

import { useEffect, useState } from 'react';
import { Heart } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useToast, errMsg } from '@/lib/toast';
import styles from './FavoriteButton.module.css';

export function FavoriteButton({
  titleId,
  favorited,
  count,
  compact = false,
}: {
  titleId: number;
  favorited: boolean;
  count: number;
  compact?: boolean;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [fav, setFav] = useState(favorited);
  const [n, setN] = useState(count);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setFav(favorited);
    setN(count);
  }, [favorited, count]);

  async function toggle() {
    if (!user) {
      toast('Войдите, чтобы добавлять в избранное', 'error');
      return;
    }
    if (busy) return;
    setBusy(true);
    const next = !fav;
    const prevFav = fav;
    const prevN = n;
    setFav(next);
    setN((v) => Math.max(0, v + (next ? 1 : -1)));
    try {
      const res = await api<{ my_favorite: boolean; favorites_count: number }>(
        `/me/favorites/${titleId}`,
        { method: next ? 'PUT' : 'DELETE' }
      );
      setFav(res.my_favorite);
      setN(res.favorites_count);
    } catch (e) {
      setFav(prevFav);
      setN(prevN);
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  }

  const label = fav ? 'Убрать из избранного' : 'Добавить в избранное';
  const cls = [styles.btn, compact ? styles.compact : '', fav ? styles.active : '']
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      className={cls}
      onClick={toggle}
      aria-pressed={fav}
      aria-label={compact ? `${label} (${n})` : undefined}
      title={compact ? `${label} · ${n}` : label}
    >
      <Heart size={15} className={fav ? styles.iconOn : styles.icon} />
      {compact ? null : (
        <span className={styles.label}>{fav ? 'В избранном' : 'В избранное'}</span>
      )}
      <span className={styles.count}>{n}</span>
    </button>
  );
}

export default FavoriteButton;
