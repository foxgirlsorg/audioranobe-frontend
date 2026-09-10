'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { chapterNumberLabel } from '@/lib/format';
import { resizeToWebp } from '@/lib/image';
import { useToast, errMsg } from '@/lib/toast';
import type { Illustration, TitleFull } from '@/lib/types';
import Select, { type SelectOption } from '@/components/Select/Select';
import ConfirmDialog from '@/components/ConfirmDialog/ConfirmDialog';
import styles from './IllustrationManager.module.css';

const MAX_PX = 2048;
const MAX_CAPTION = 200;
const ACCEPT = 'image/jpeg,image/png,image/webp';

export default function IllustrationManager({ title }: { title: TitleFull }) {
  const { toast } = useToast();
  const [items, setItems] = useState<Illustration[]>(title.illustrations ?? []);

  const [bindMode, setBindMode] = useState<'title' | 'chapter'>('title');
  const [targetVol, setTargetVol] = useState<number | null>(null);
  const [targetChap, setTargetChap] = useState<number | null>(null);

  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Illustration | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => { setItems(title.illustrations ?? []); }, [title.illustrations]);

  const chapterOf = useMemo(() => {
    const map = new Map<number, { id: number; number: number; number_end: number | null; name: string; volume: { id: number; number: number } }>();
    for (const v of title.volumes) {
      for (const c of v.chapters) {
        if (!c.is_deleted) map.set(c.id, { ...c, volume: { id: v.id, number: v.number } });
      }
    }
    return map;
  }, [title.volumes]);

  const targetChapterId = bindMode === 'chapter' ? targetChap : null;

  useEffect(() => { setTargetChap(null); }, [targetVol]);

  const volOptions: SelectOption<string>[] = useMemo(
    () => title.volumes.map((v) => ({ value: String(v.id), label: `Том ${v.number}` })),
    [title.volumes],
  );

  const targetChapOptions: SelectOption<string>[] = useMemo(() => {
    if (!targetVol) return [];
    const vol = title.volumes.find((v) => v.id === targetVol);
    if (!vol) return [];
    return vol.chapters
      .filter((c) => !c.is_deleted)
      .map((c) => ({ value: String(c.id), label: chapterNumberLabel(c.number, c.number_end) }));
  }, [title.volumes, targetVol]);

  async function upload(files: File[]) {
    const images = files.filter((f) => ACCEPT.split(',').includes(f.type));
    if (images.length < files.length) toast('Подходят только JPEG, PNG и WebP', 'error');
    if (images.length === 0) return;

    setUploading({ done: 0, total: images.length });
    let ok = 0;
    for (const file of images) {
      try {
        const blob = await resizeToWebp(file, MAX_PX, MAX_PX);
        const fd = new FormData();
        fd.append('file', blob, file.name.replace(/\.[^.]+$/, '') + '.webp');
        if (targetChapterId != null) fd.append('chapter_id', String(targetChapterId));
        const created = await api<Illustration>(`/panel/titles/${title.id}/illustrations`, { formData: fd });
        setItems((prev) => [...prev, created]);
        ok += 1;
      } catch (err) {
        toast(`${file.name}: ${errMsg(err)}`, 'error');
      }
      setUploading((u) => (u ? { ...u, done: u.done + 1 } : u));
    }
    setUploading(null);
    if (ok > 0) toast(ok === 1 ? 'Иллюстрация добавлена' : `Добавлено иллюстраций: ${ok}`);
  }

  async function patch(ill: Illustration, body: { caption?: string; chapter_id?: number | null }) {
    setBusy(ill.id);
    try {
      const updated = await api<Illustration>(`/panel/illustrations/${ill.id}`, { method: 'PATCH', body });
      setItems((prev) => prev.map((i) => (i.id === ill.id ? updated : i)));
      return true;
    } catch (err) {
      toast(errMsg(err), 'error');
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function move(index: number, delta: -1 | 1) {
    const to = index + delta;
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    [next[index], next[to]] = [next[to], next[index]];
    const before = items;
    setItems(next);
    try {
      const res = await api<{ items: Illustration[] }>(`/panel/titles/${title.id}/illustrations/order`, {
        method: 'PUT',
        body: { ids: next.map((i) => i.id) },
      });
      setItems(res.items);
    } catch (err) {
      setItems(before);
      toast(errMsg(err), 'error');
    }
  }

  async function remove(ill: Illustration) {
    setConfirmDelete(null);
    setBusy(ill.id);
    try {
      await api(`/panel/illustrations/${ill.id}`, { method: 'DELETE' });
      setItems((prev) => prev.filter((i) => i.id !== ill.id));
      toast('Иллюстрация удалена');
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={styles.wrap}>
      <section className={`glass-panel ${styles.upload}`}>
        <div className={styles.bindControls}>
          <span className={styles.label}>Привязать к</span>
          <div className={styles.bindRow}>
            <div className={styles.segmented} role="group" aria-label="Привязать к">
              <button
                type="button"
                className={`${styles.segTab}${bindMode === 'title' ? ` ${styles.segActive}` : ''}`}
                aria-pressed={bindMode === 'title'}
                onClick={() => { setBindMode('title'); setTargetVol(null); setTargetChap(null); }}
              >
                Тайтлу
              </button>
              <button
                type="button"
                className={`${styles.segTab}${bindMode === 'chapter' ? ` ${styles.segActive}` : ''}`}
                aria-pressed={bindMode === 'chapter'}
                onClick={() => setBindMode('chapter')}
              >
                Главе
              </button>
            </div>
            {bindMode === 'chapter' && (
              <div className={styles.chapterSelects}>
                <Select
                  value={targetVol != null ? String(targetVol) : ''}
                  options={volOptions}
                  onChange={(v) => setTargetVol(Number(v))}
                  placeholder="Том"
                  ariaLabel="Том"
                />
                <Select
                  value={targetChap != null ? String(targetChap) : ''}
                  options={targetChapOptions}
                  onChange={(v) => setTargetChap(Number(v))}
                  placeholder="Глава"
                  disabled={!targetVol}
                  ariaLabel="Глава"
                />
              </div>
            )}
          </div>
        </div>

        <div
          className={`${styles.dropTarget}${dragOver ? ` ${styles.dropOver}` : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); if (!uploading) void upload([...e.dataTransfer.files]); }}
          onClick={() => fileInput.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.current?.click(); } }}
          aria-label="Загрузить иллюстрации"
        >
          <span className={styles.dropIconWrap}>
            {uploading ? (
              <Loader2 size={20} className={`${styles.dropIcon} ${styles.spin}`} aria-hidden="true" />
            ) : (
              <ImagePlus size={20} className={styles.dropIcon} aria-hidden="true" />
            )}
          </span>
          <div className={styles.dropText}>
            <p className={styles.dropTitle}>
              {uploading ? `Загрузка ${uploading.done + 1} из ${uploading.total}` : 'Перетащите изображения сюда'}
            </p>
            <p className={styles.dropHint}>или кликните, чтобы выбрать</p>
          </div>
        </div>

        <input
          ref={fileInput}
          type="file"
          accept={ACCEPT}
          multiple
          hidden
          onChange={(e) => { const files = [...(e.target.files ?? [])]; e.target.value = ''; void upload(files); }}
        />
      </section>

      {items.length === 0 ? (
        <p className={styles.empty}>
          Иллюстраций пока нет. Привязанные к главе показываются вместо обложки в полноэкранном плеере,
          пока играет эта глава; все остальные — во вкладке «Иллюстрации» на странице тайтла.
        </p>
      ) : (
        <div className={styles.grid}>
          {items.map((ill, index) => (
            <IllustrationCard
              key={ill.id}
              ill={ill}
              index={index}
              count={items.length}
              busy={busy === ill.id}
              chapterOf={chapterOf}
              volOptions={volOptions}
              onCaption={(caption) => patch(ill, { caption })}
              onChapter={(v) => void patch(ill, { chapter_id: v })}
              onMove={(d) => void move(index, d)}
              onDelete={() => setConfirmDelete(ill)}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && void remove(confirmDelete)}
        title="Удалить иллюстрацию?"
        body="Изображение удалится с сайта насовсем — вернуть его можно будет только повторной загрузкой."
        danger
      />
    </div>
  );
}

function IllustrationCard({
  ill,
  index,
  count,
  busy,
  chapterOf,
  volOptions,
  onCaption,
  onChapter,
  onMove,
  onDelete,
}: {
  ill: Illustration;
  index: number;
  count: number;
  busy: boolean;
  chapterOf: Map<number, { id: number; number: number; number_end: number | null; name: string; volume: { id: number; number: number } }>;
  volOptions: SelectOption<string>[];
  onCaption: (caption: string) => Promise<boolean>;
  onChapter: (chapterId: number | null) => void;
  onMove: (delta: -1 | 1) => void;
  onDelete: () => void;
}) {
  const [caption, setCaption] = useState(ill.caption);
  useEffect(() => setCaption(ill.caption), [ill.caption]);

  const [editVolId, setEditVolId] = useState<number | null>(() => {
    const ch = ill.chapter_id != null ? chapterOf.get(ill.chapter_id) : null;
    return ch ? ch.volume.id : null;
  });
  const [editChapId, setEditChapId] = useState<number | null>(ill.chapter_id);

  useEffect(() => {
    const ch = ill.chapter_id != null ? chapterOf.get(ill.chapter_id) : null;
    setEditVolId(ch ? ch.volume.id : null);
    setEditChapId(ill.chapter_id);
  }, [ill.chapter_id, chapterOf]);

  useEffect(() => { setEditChapId(null); }, [editVolId]);

  const chapOptions: SelectOption<string>[] = useMemo(() => {
    if (!editVolId) return [];
    const chapters: { id: number; number: number; number_end: number | null; name: string }[] = [];
    for (const [, ch] of chapterOf) {
      if (ch.volume.id === editVolId) chapters.push(ch);
    }
    return chapters.map((c) => ({
      value: String(c.id),
      label: chapterNumberLabel(c.number, c.number_end),
    }));
  }, [editVolId, chapterOf]);

  const commit = async () => {
    const next = caption.trim();
    if (next === ill.caption) { setCaption(next); return; }
    if (!(await onCaption(next))) setCaption(ill.caption);
  };

  const handleVolumeChange = (v: string) => {
    const newVolId = v === '' ? null : Number(v);
    setEditVolId(newVolId);
    setEditChapId(null);
    onChapter(null);
  };

  const handleChapterChange = (v: string) => {
    const newChapId = v === '' ? null : Number(v);
    setEditChapId(newChapId);
    onChapter(newChapId);
  };

  const isChapter = editVolId != null;

  return (
    <article className={`glass-panel ${styles.card}`}>
      <div className={styles.preview}>
        <img src={ill.thumb_url} alt={ill.caption} width={ill.width} height={ill.height} loading="lazy" />
        <span className={styles.size}>{`${ill.width}×${ill.height}`}</span>
        {busy ? (
          <span className={styles.previewBusy}>
            <Loader2 size={18} className={styles.spin} />
          </span>
        ) : null}
      </div>

      <div className={styles.cardBind}>
        <div className={styles.segmented} role="group" aria-label="Привязка">
          <button
            type="button"
            className={`${styles.segTab}${!isChapter ? ` ${styles.segActive}` : ''}`}
            aria-pressed={!isChapter}
            onClick={() => { setEditVolId(null); setEditChapId(null); onChapter(null); }}
          >
            Тайтл
          </button>
          <button
            type="button"
            className={`${styles.segTab}${isChapter ? ` ${styles.segActive}` : ''}`}
            aria-pressed={isChapter}
            onClick={() => { if (!editVolId && volOptions.length > 0) setEditVolId(Number(volOptions[0].value)); }}
          >
            Глава
          </button>
        </div>
        {isChapter && (
          <div className={styles.chapterSelects}>
            <Select
              value={editVolId != null ? String(editVolId) : ''}
              options={volOptions}
              onChange={handleVolumeChange}
              placeholder="Том"
              ariaLabel="Том"
              size="sm"
              className={styles.cardSelect}
            />
            <Select
              value={editChapId != null ? String(editChapId) : ''}
              options={chapOptions}
              onChange={handleChapterChange}
              placeholder="Глава"
              disabled={!editVolId}
              ariaLabel="Глава"
              size="sm"
              className={styles.cardSelect}
            />
          </div>
        )}
      </div>

      <input
        className={`input ${styles.captionInput}`}
        type="text"
        value={caption}
        maxLength={MAX_CAPTION}
        placeholder="Подпись (необязательно)"
        aria-label="Подпись"
        onChange={(e) => setCaption(e.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          if (e.key === 'Escape') { setCaption(ill.caption); (e.target as HTMLInputElement).blur(); }
        }}
      />

      <div className={styles.cardFoot}>
        <div className={styles.moveBtns}>
          <button type="button" className={styles.iconBtn} onClick={() => onMove(-1)} disabled={index === 0}
            aria-label="Сдвинуть раньше" title="Сдвинуть раньше">
            <ArrowLeft size={15} />
          </button>
          <button type="button" className={styles.iconBtn} onClick={() => onMove(1)} disabled={index === count - 1}
            aria-label="Сдвинуть позже" title="Сдвинуть позже">
            <ArrowRight size={15} />
          </button>
        </div>
        <button type="button" className={`${styles.iconBtn} ${styles.danger}`} onClick={onDelete}
          aria-label="Удалить" title="Удалить">
          <Trash2 size={15} />
        </button>
      </div>
    </article>
  );
}
