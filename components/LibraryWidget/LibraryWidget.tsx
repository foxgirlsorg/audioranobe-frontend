'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BookmarkPlus, X, LogIn } from 'lucide-react';
import { api } from '@/lib/api';
import {
  LIBRARY_STATUS_LABELS,
  LIBRARY_STATUS_VALUES,
  type LibraryEntry,
} from '@/lib/types';
import { useAuth } from '@/lib/auth';
import { useToast, errMsg } from '@/lib/toast';
import Select from '@/components/Select/Select';
import styles from './LibraryWidget.module.css';

export function LibraryWidget({
  titleId,
  entry,
  onChange,
  userId,
  alwaysShowNote,
}: {
  titleId: number;
  entry: { status: string; note: string } | null;
  onChange: (entry: { status: string; note: string } | null) => void;
  userId?: number;
  // Keeps the note field visible (disabled, empty) even when the title isn't
  // in the library yet, instead of hiding it entirely. Desktop only — mobile
  // stays compact and only shows the note once the title is actually added.
  alwaysShowNote?: boolean;
}) {
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const [note, setNote] = useState(entry?.note ?? '');
  const [busy, setBusy] = useState(false);
  const [savingNote, setSavingNote] = useState(false);

  useEffect(() => {
    setNote(entry?.note ?? '');
  }, [entry?.note]);

  const foreign = userId != null && user != null && userId !== user.id;
  const path = foreign
    ? `/mod/users/${userId}/library/${titleId}`
    : `/me/library/${titleId}`;

  if (loading) return null;

  if (!user) {
    return (
      <div className={styles.widget}>
        <div className={styles.eyebrow}>
          <BookmarkPlus size={12} />
          {'Моя библиотека'}
        </div>
        <p className={styles.guest}>
          {'Отслеживайте прослушивания — добавьте этот тайтл в свою библиотеку.'}
        </p>
        <Link href="/auth/login" className={styles.loginBtn}>
          <LogIn size={14} />
          {'Войти'}
        </Link>
      </div>
    );
  }

  async function setStatus(status: string) {
    if (busy) return;
    setBusy(true);
    try {
      const res = await api<LibraryEntry>(path, {
        method: 'PUT',
        body: { status },
      });
      onChange({ status: res.status, note: res.note });
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (busy) return;
    setBusy(true);
    try {
      await api(path, { method: 'DELETE' });
      onChange(null);
      setNote('');
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function saveNote() {
    if (savingNote) return;
    setSavingNote(true);
    try {
      const res = await api<LibraryEntry>(path, {
        method: 'PUT',
        body: { note },
      });
      onChange({ status: res.status, note: res.note });
      toast('Заметка сохранена', 'ok');
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setSavingNote(false);
    }
  }

  const noteDirty = note !== (entry?.note ?? '');

  return (
    <div className={styles.widget}>
      <div className={styles.eyebrow}>
        <BookmarkPlus size={12} />
        {foreign ? 'Библиотека пользователя' : 'Моя библиотека'}
      </div>
      <div className={styles.selectRow}>
        <div className={styles.selectWrap}>
          <Select
            block
            value={entry?.status ?? ''}
            disabled={busy}
            ariaLabel={'Список в библиотеке'}
            placeholder={'Не в библиотеке'}
            options={[
              { value: '', label: 'Не в библиотеке' },
              ...LIBRARY_STATUS_VALUES.map((k) => ({ value: k, label: LIBRARY_STATUS_LABELS[k] })),
            ]}
            onChange={(next) => {
              if (next === '') void remove();
              else if (next !== entry?.status) void setStatus(next);
            }}
          />
        </div>
        {entry ? (
          <button
            type="button"
            disabled={busy}
            className={styles.removeBtn}
            onClick={remove}
            title={'Удалить из библиотеки'}
            aria-label={'Удалить из библиотеки'}
          >
            <X size={14} />
          </button>
        ) : null}
      </div>

      {entry || alwaysShowNote ? (
        <div className={styles.noteBlock}>
          <label className={styles.noteLabel} htmlFor={`library-note-${titleId}`}>
            {'Заметка'}
          </label>
          <textarea
            id={`library-note-${titleId}`}
            className={styles.note}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={2000}
            disabled={!entry}
            placeholder={
              !entry
                ? 'Добавьте тайтл в библиотеку, чтобы оставить заметку'
                : foreign
                ? 'Заметка в списке этого пользователя…'
                : 'Видна всем в вашем профиле…'
            }
          />
          <div className={styles.noteRow}>
            <span className={styles.noteCounter}>{note.length}/2000</span>
            <button
              type="button"
              className={styles.save}
              onClick={saveNote}
              disabled={!entry || savingNote || !noteDirty}
            >
              {savingNote ? 'Сохранение…' : 'Сохранить заметку'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default LibraryWidget;
