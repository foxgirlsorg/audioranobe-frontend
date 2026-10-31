'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '@/lib/api';
import { errMsg, useToast } from '@/lib/toast';
import { chapterNumberLabel } from '@/lib/format';
import type { TextChapter } from '@/lib/types';
import Modal from '@/components/Modal/Modal';
import ConfirmDialog from '@/components/ConfirmDialog/ConfirmDialog';
import Spinner from '@/components/Spinner/Spinner';
import styles from './TextBranch.module.css';

const CPS = 14;
const MAX_CHARS = 1_000_000;

export default function TextEditorModal({
  chapter,
  caption,
  announcement,
  canPrev,
  canNext,
  onNavigate,
  onClose,
  onSaved,
  onRemove,
  onResync,
}: {
  chapter: TextChapter;
  caption: string;
  announcement: string;
  canPrev: boolean;
  canNext: boolean;
  onNavigate: (delta: -1 | 1) => void;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
  onRemove: (id: number) => void;
  onResync: (id: number) => void;
}) {
  const { toast } = useToast();
  const [original, setOriginal] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [enabled, setEnabled] = useState(chapter.enabled);
  const [edited, setEdited] = useState(chapter.edited);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [discard, setDiscard] = useState<null | (() => void)>(null);

  useEffect(() => {
    let alive = true;
    setOriginal(null);
    setError('');
    setEnabled(chapter.enabled);
    setEdited(chapter.edited);
    api<{ text: string }>(`/panel/chapters/${chapter.id}/text`)
      .then((r) => {
        if (!alive) return;
        setOriginal(r.text);
        setText(r.text);
      })
      .catch((e) => alive && setError(errMsg(e)));
    return () => { alive = false; };
  }, [chapter.id, chapter.enabled, chapter.edited]);

  const dirty = original !== null && text !== original;
  const stats = useMemo(() => {
    const t = text.trim();
    return {
      chars: t.length,
      words: t ? t.split(/\s+/).length : 0,
      paras: t ? t.split(/\n+/).length : 0,
      secs: Math.round(t.length / CPS),
    };
  }, [text]);

  const save = useCallback(async () => {
    if (!dirty || saving) return;
    if (!text.trim()) {
      toast('Текст не может быть пустым', 'error');
      return;
    }
    if (text.length > MAX_CHARS) {
      toast('Текст слишком большой', 'error');
      return;
    }
    setSaving(true);
    try {
      await api(`/chapters/${chapter.id}/text`, { method: 'PUT', body: { text } });
      toast('Текст сохранён');
      setOriginal(text);
      setEdited(true);
      await onSaved();
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setSaving(false);
    }
  }, [dirty, saving, text, chapter.id, toast, onSaved]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void save();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [save]);

  async function toggleEnabled(next: boolean) {
    setEnabled(next);
    try {
      await api('/panel/texts', { method: 'POST', body: { ids: [chapter.id], action: next ? 'enable' : 'disable' } });
      await onSaved();
    } catch (e) {
      setEnabled(!next);
      toast(errMsg(e), 'error');
    }
  }

  const guard = (fn: () => void) => (dirty ? setDiscard(() => fn) : fn());
  const label = chapter.name || `Глава ${chapterNumberLabel(chapter.number, chapter.number_end)}`;

  const nav = (
    <>
      <button type="button" className={styles.sq} aria-label="Предыдущая глава" disabled={!canPrev} onClick={() => guard(() => onNavigate(-1))}>
        <ChevronLeft size={16} />
      </button>
      <button type="button" className={styles.sq} aria-label="Следующая глава" disabled={!canNext} onClick={() => guard(() => onNavigate(1))}>
        <ChevronRight size={16} />
      </button>
    </>
  );

  return (
    <>
      <Modal open onClose={() => guard(onClose)} title={label} subtitle={caption} actions={nav} size="xwide">
        {error ? (
          <p className={styles.error}>{error}</p>
        ) : original === null ? (
          <div className={styles.center}><Spinner /></div>
        ) : (
          <div className={styles.editor}>
            <div className={styles.editorGrid}>
              <aside className={styles.side}>
                <section>
                  <h4 className={styles.sideHead}>Объём</h4>
                  <dl className={styles.kvList}>
                    <div><dt>Знаков</dt><dd>{stats.chars.toLocaleString('ru-RU')}</dd></div>
                    <div><dt>Слов</dt><dd>{stats.words.toLocaleString('ru-RU')}</dd></div>
                    <div><dt>Абзацев</dt><dd>{stats.paras}</dd></div>
                    <div><dt>Озвучка на 1×</dt><dd>{`≈ ${Math.floor(stats.secs / 60)} мин ${stats.secs % 60} с`}</dd></div>
                  </dl>
                </section>
                <section>
                  <h4 className={styles.sideHead}>Глава</h4>
                  <div className={styles.switchRow}>
                    <span>
                      <b>Озвучка включена</b>
                      <small>Выключенная глава не звучит</small>
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={enabled}
                      aria-label="Озвучка включена"
                      className={enabled ? `${styles.sw} ${styles.swOn}` : styles.sw}
                      onClick={() => void toggleEnabled(!enabled)}
                    />
                  </div>
                </section>
                {edited ? <p className={styles.sideNote}>Изменён вручную — источник его не перезапишет.</p> : null}
                <div className={styles.sideActions}>
                  <button type="button" className={styles.mbtn} onClick={() => guard(() => onResync(chapter.id))}>Вернуть текст источника</button>
                  <button type="button" className={`${styles.mbtn} ${styles.mbtnDng}`} onClick={() => guard(() => onRemove(chapter.id))}>Удалить текст главы</button>
                </div>
              </aside>
              <div className={styles.edCol}>
                <div className={styles.edbar}>
                  <span>Прозвучит первой строкой:</span>
                  <span className={styles.pill}>{announcement}</span>
                </div>
                <textarea
                  className={styles.paper}
                  value={text}
                  spellCheck={false}
                  onChange={(e) => setText(e.target.value)}
                  aria-label="Текст главы"
                />
              </div>
            </div>
            <div className={styles.mfoot}>
              <span className={styles.mstate}>{dirty ? <><i />Есть несохранённые изменения</> : null}</span>
              <button type="button" className={styles.mbtn} onClick={() => guard(onClose)}>Отмена</button>
              <button type="button" className={`${styles.mbtn} ${styles.mbtnPri}`} disabled={!dirty || saving} onClick={() => void save()}>
                {saving ? 'Сохраняем…' : 'Сохранить'}
                <kbd>Ctrl S</kbd>
              </button>
            </div>
          </div>
        )}
      </Modal>
      <ConfirmDialog
        open={discard !== null}
        onClose={() => setDiscard(null)}
        onConfirm={() => discard?.()}
        danger
        title="Закрыть без сохранения?"
        body="Несохранённые правки текста пропадут."
      />
    </>
  );
}
