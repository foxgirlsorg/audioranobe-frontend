'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Heart, Pencil, Star, Trash2, X } from 'lucide-react';
import { api } from '@/lib/api';
import {
  LIBRARY_STATUS_LABELS,
  LIBRARY_STATUS_VALUES,
  type LibraryEntry,
  type LibraryStatus,
} from '@/lib/types';
import { useToast, errMsg } from '@/lib/toast';
import Select from '@/components/Select/Select';
import styles from './LibraryRow.module.css';

function Stars({
  value,
  size,
  onRate,
}: {
  value: number | null;
  size: number;
  onRate?: (v: number | null) => void;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const interactive = typeof onRate === 'function';
  const shown = hover ?? value ?? 0;

  return (
    <div
      className={interactive ? `${styles.stars} ${styles.starsLive}` : styles.stars}
      onMouseLeave={() => setHover(null)}
      role={interactive ? 'radiogroup' : 'img'}
      aria-label={value != null ? `Оценка ${value} из 10` : 'Без оценки'}
    >
      {Array.from({ length: 10 }, (_, idx) => {
        const i = idx + 1;
        const on = i <= shown;
        return (
          <button
            key={i}
            type="button"
            className={styles.star}
            disabled={!interactive}
            tabIndex={interactive ? 0 : -1}
            aria-label={i === value ? `Убрать оценку ${i}` : `Оценить на ${i} из 10`}
            title={interactive ? (i === value ? 'Убрать оценку' : `Оценить на ${i}`) : undefined}
            onMouseEnter={interactive ? () => setHover(i) : undefined}
            onFocus={interactive ? () => setHover(i) : undefined}
            onBlur={interactive ? () => setHover(null) : undefined}
            onClick={onRate ? () => onRate(i === value ? null : i) : undefined}
          >
            <Star
              size={size}
              className={on ? styles.starOn : styles.starOff}
              fill={on ? 'currentColor' : 'none'}
            />
          </button>
        );
      })}
    </div>
  );
}

export function LibraryRow({
  entry,
  userId,
  canEdit,
  isOwnShelf,
  onChange,
  onRemove,
}: {
  entry: LibraryEntry;
  userId: number;
  canEdit: boolean;
  isOwnShelf: boolean;
  onChange: (next: LibraryEntry) => void;
  onRemove: () => void;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(entry.note);

  useEffect(() => {
    setNote(entry.note);
  }, [entry.note]);

  const t = entry.title;
  const titleId = t.id;
  const libraryPath = isOwnShelf
    ? `/me/library/${titleId}`
    : `/mod/users/${userId}/library/${titleId}`;
  const ratingPath = isOwnShelf
    ? `/titles/${titleId}/rating`
    : `/mod/users/${userId}/rating/${titleId}`;
  const favoritePath = isOwnShelf
    ? `/me/favorites/${titleId}`
    : `/mod/users/${userId}/favorites/${titleId}`;

  async function run(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  }

  const setStatus = (status: LibraryStatus) =>
    run(async () => {
      const res = await api<LibraryEntry>(libraryPath, { method: 'PUT', body: { status } });
      onChange({ ...entry, status: res.status, note: res.note });
    });

  const saveNote = () =>
    run(async () => {
      const res = await api<LibraryEntry>(libraryPath, { method: 'PUT', body: { note } });
      onChange({ ...entry, status: res.status, note: res.note });
      toast('Заметка сохранена', 'ok');
    });

  const setRating = (value: number | null) =>
    run(async () => {
      if (value === null) await api(ratingPath, { method: 'DELETE' });
      else await api(ratingPath, { method: 'PUT', body: { value } });
      onChange({ ...entry, rating: value });
    });

  const toggleFavorite = () =>
    run(async () => {
      const next = !entry.is_favorite;
      await api(favoritePath, { method: next ? 'PUT' : 'DELETE' });
      onChange({ ...entry, is_favorite: next });
    });

  const remove = () =>
    run(async () => {
      await api(libraryPath, { method: 'DELETE' });
      onRemove();
    });

  const noteDirty = note !== entry.note;

  return (
    <div className={`glass-panel ${styles.row} ${open ? styles.rowOpen : ''}`}>
      <div className={styles.main}>
        <Link href={`/title/${t.slug}`} className={styles.cover} tabIndex={-1} aria-hidden="true">
          {t.cover_thumb_url || t.cover_url ? (
            <img src={t.cover_thumb_url || t.cover_url || ''} alt="" className={styles.coverImg} />
          ) : (
            <span className={styles.coverEmpty} />
          )}
        </Link>

        <div className={styles.body}>
          <Link href={`/title/${t.slug}`} className={styles.name}>
            {t.name}
          </Link>
          <div className={styles.meta}>
            {t.year ? <span>{t.year}</span> : null}
            {t.author ? <span className={styles.author}>{t.author.name}</span> : null}
            <span className={styles.status}>{LIBRARY_STATUS_LABELS[entry.status]}</span>
          </div>
          {entry.note ? <p className={styles.note}>{entry.note}</p> : null}
        </div>

        <div className={styles.marks}>
          {entry.is_favorite ? (
            <span className={styles.fav} title="В избранном">
              <Heart size={14} fill="currentColor" />
            </span>
          ) : null}
          <span
            className={entry.rating ? styles.rating : styles.ratingEmpty}
            title={entry.rating ? `Оценка ${entry.rating} из 10` : 'Без оценки'}
          >
            <Star size={13} className={styles.ratingStar} fill={entry.rating ? 'currentColor' : 'none'} />
            {entry.rating ?? '—'}
          </span>
          {canEdit ? (
            <button
              type="button"
              className={styles.editBtn}
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
              title={open ? 'Закрыть' : 'Изменить'}
            >
              {open ? <X size={14} /> : <Pencil size={14} />}
              <span className={styles.editLabel}>{open ? 'Закрыть' : 'Изменить'}</span>
            </button>
          ) : null}
        </div>
      </div>

      {canEdit && open ? (
        <div className={styles.editor}>
          <div className={styles.controls}>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Список</span>
              <Select<LibraryStatus>
                size="sm"
                value={entry.status}
                disabled={busy}
                options={LIBRARY_STATUS_VALUES.map((k) => ({
                  value: k,
                  label: LIBRARY_STATUS_LABELS[k],
                }))}
                onChange={setStatus}
                ariaLabel="Список в библиотеке"
              />
            </div>

            <div className={styles.field}>
              <span className={styles.fieldLabel}>Оценка</span>
              <div className={styles.rateRow}>
                <Stars value={entry.rating} size={18} onRate={busy ? undefined : setRating} />
                <span className={styles.rateValue}>{entry.rating ?? '—'}</span>
              </div>
            </div>

            <div className={styles.actions}>
              <button
                type="button"
                className={entry.is_favorite ? `${styles.favBtn} ${styles.favBtnOn}` : styles.favBtn}
                disabled={busy}
                onClick={toggleFavorite}
              >
                <Heart size={14} fill={entry.is_favorite ? 'currentColor' : 'none'} />
                {entry.is_favorite ? 'В избранном' : 'В избранное'}
              </button>

              <button type="button" className={styles.removeBtn} disabled={busy} onClick={remove}>
                <Trash2 size={14} />
                Убрать из списка
              </button>
            </div>
          </div>

          <div className={styles.noteBlock}>
            <textarea
              className={styles.noteInput}
              value={note}
              rows={2}
              maxLength={2000}
              placeholder={isOwnShelf ? 'Заметка — видна всем в вашем профиле…' : 'Заметка пользователя…'}
              onChange={(e) => setNote(e.target.value)}
            />
            <div className={styles.noteFoot}>
              <span className={styles.noteCounter}>{note.length}/2000</span>
              <button
                type="button"
                className={styles.save}
                disabled={busy || !noteDirty}
                onClick={saveNote}
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default LibraryRow;
