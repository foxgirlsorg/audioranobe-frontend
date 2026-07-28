'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BookmarkPlus, ChevronDown, X, LogIn } from 'lucide-react';
import { api } from '@/lib/api';
import {
  LIBRARY_STATUS_LABELS,
  LIBRARY_STATUS_VALUES,
  type LibraryEntry,
} from '@/lib/types';
import { useAuth } from '@/lib/auth';
import { useToast, errMsg } from '@/lib/toast';
import styles from './LibraryWidget.module.css';

export function LibraryWidget({
  titleId,
  entry,
  onChange,
}: {
  titleId: number;
  entry: { status: string; note: string } | null;
  onChange: (entry: { status: string; note: string } | null) => void;
}) {
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const [note, setNote] = useState(entry?.note ?? '');
  const [busy, setBusy] = useState(false);
  const [savingNote, setSavingNote] = useState(false);

  useEffect(() => {
    setNote(entry?.note ?? '');
  }, [entry?.note]);

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
      const res = await api<LibraryEntry>(`/me/library/${titleId}`, {
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
      await api(`/me/library/${titleId}`, { method: 'DELETE' });
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
      const res = await api<LibraryEntry>(`/me/library/${titleId}`, {
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
        {'Моя библиотека'}
      </div>
      <div className={styles.selectRow}>
        <div className={styles.selectWrap}>
          <select
            className={styles.select}
            value={entry?.status ?? ''}
            disabled={busy}
            aria-label={'Список в библиотеке'}
            onChange={(e) => {
              const next = e.target.value;
              if (next === '') void remove();
              else if (next !== entry?.status) void setStatus(next);
            }}
          >
            <option value="">{'Не в библиотеке'}</option>
            {LIBRARY_STATUS_VALUES.map((k) => (
              <option key={k} value={k}>
                {LIBRARY_STATUS_LABELS[k]}
              </option>
            ))}
          </select>
          <ChevronDown size={14} className={styles.selectIcon} aria-hidden="true" />
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

      {entry ? (
        <div className={styles.noteBlock}>
          <label className={styles.noteLabel} htmlFor={`library-note-${titleId}`}>
            {'Личная заметка'}
          </label>
          <textarea
            id={`library-note-${titleId}`}
            className={styles.note}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder={'Только вы можете это видеть…'}
          />
          <div className={styles.noteRow}>
            <span className={styles.noteCounter}>{note.length}/2000</span>
            <button
              type="button"
              className={styles.save}
              onClick={saveNote}
              disabled={savingNote || !noteDirty}
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
