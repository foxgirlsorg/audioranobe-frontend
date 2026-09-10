'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { chapterLabel } from '@/lib/format';
import { resizeToWebp } from '@/lib/image';
import { useToast, errMsg } from '@/lib/toast';
import type { Illustration, TitleFull } from '@/lib/types';
import Select, { type SelectOption } from '@/components/Select/Select';
import ConfirmDialog from '@/components/ConfirmDialog/ConfirmDialog';
import styles from './IllustrationManager.module.css';

/** Same cap the server enforces (Img::MAX_ILLUSTRATION); any aspect ratio, never cropped. */
const MAX_PX = 2048;
const MAX_CAPTION = 200;
const ACCEPT = 'image/jpeg,image/png,image/webp';
const WHOLE_TITLE = 'title';

/**
 * The edit page's "Иллюстрации" tab: upload (several at once, or drag and
 * drop), caption, bind to the title or one chapter, reorder, delete. Every
 * change saves immediately — there's no form-level Save here, same as the
 * artwork tab.
 */
export default function IllustrationManager({ title }: { title: TitleFull }) {
  const { toast } = useToast();
  const [items, setItems] = useState<Illustration[]>(title.illustrations ?? []);
  const [target, setTarget] = useState<string>(WHOLE_TITLE);
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Illustration | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setItems(title.illustrations ?? []);
  }, [title.illustrations]);

  const chapterOptions = useMemo<SelectOption<string>[]>(
    () => [
      { value: WHOLE_TITLE, label: 'Весь тайтл' },
      ...title.volumes.flatMap((v) =>
        v.chapters
          .filter((c) => !c.is_deleted)
          .map((c) => ({
            value: String(c.id),
            label: `Том ${v.number} · ${chapterLabel(c.number, c.number_end, c.name)}`,
          }))
      ),
    ],
    [title.volumes]
  );

  async function upload(files: File[]) {
    const images = files.filter((f) => ACCEPT.split(',').includes(f.type));
    if (images.length < files.length) toast('Подходят только JPEG, PNG и WebP', 'error');
    if (images.length === 0) return;

    setUploading({ done: 0, total: images.length });
    let ok = 0;
    // One at a time: keeps upload order = gallery order, and a failure on one
    // file doesn't lose the rest.
    for (const file of images) {
      try {
        const blob = await resizeToWebp(file, MAX_PX, MAX_PX);
        const fd = new FormData();
        fd.append('file', blob, file.name.replace(/\.[^.]+$/, '') + '.webp');
        if (target !== WHOLE_TITLE) fd.append('chapter_id', target);
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
      <section
        className={`glass-panel ${styles.drop}${dragOver ? ` ${styles.dropOver}` : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (!uploading) void upload([...e.dataTransfer.files]);
        }}
      >
        <div className={styles.dropMain}>
          <ImagePlus size={22} className={styles.dropIcon} aria-hidden="true" />
          <div>
            <p className={styles.dropTitle}>Перетащите изображения сюда</p>
            <p className={styles.dropHint}>
              JPEG, PNG или WebP · любые пропорции, без обрезки · до {MAX_PX}px по большей стороне
              (крупнее — уменьшим автоматически)
            </p>
          </div>
        </div>
        <div className={styles.dropActions}>
          <div className={styles.target}>
            <span className={styles.label}>Привязать к</span>
            <Select<string>
              size="sm"
              value={target}
              options={chapterOptions}
              onChange={setTarget}
              ariaLabel="Куда добавить иллюстрации"
            />
          </div>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!!uploading}
            onClick={() => fileInput.current?.click()}
          >
            {uploading ? (
              <>
                <Loader2 size={15} className={styles.spin} />
                {`Загрузка ${uploading.done + 1} из ${uploading.total}…`}
              </>
            ) : (
              <>
                <ImagePlus size={15} />
                Выбрать файлы
              </>
            )}
          </button>
          <input
            ref={fileInput}
            type="file"
            accept={ACCEPT}
            multiple
            hidden
            onChange={(e) => {
              const files = [...(e.target.files ?? [])];
              e.target.value = '';
              void upload(files);
            }}
          />
        </div>
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
              chapterOptions={chapterOptions}
              onCaption={(caption) => patch(ill, { caption })}
              onChapter={(v) => void patch(ill, { chapter_id: v === WHOLE_TITLE ? null : Number(v) })}
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
  chapterOptions,
  onCaption,
  onChapter,
  onMove,
  onDelete,
}: {
  ill: Illustration;
  index: number;
  count: number;
  busy: boolean;
  chapterOptions: SelectOption<string>[];
  onCaption: (caption: string) => Promise<boolean>;
  onChapter: (value: string) => void;
  onMove: (delta: -1 | 1) => void;
  onDelete: () => void;
}) {
  const [caption, setCaption] = useState(ill.caption);
  useEffect(() => setCaption(ill.caption), [ill.caption]);

  const commit = async () => {
    const next = caption.trim();
    if (next === ill.caption) {
      setCaption(next);
      return;
    }
    if (!(await onCaption(next))) setCaption(ill.caption);
  };

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
          if (e.key === 'Escape') {
            setCaption(ill.caption);
            (e.target as HTMLInputElement).blur();
          }
        }}
      />

      <Select<string>
        size="sm"
        block
        value={ill.chapter_id == null ? WHOLE_TITLE : String(ill.chapter_id)}
        options={chapterOptions}
        onChange={onChapter}
        ariaLabel="Привязка"
      />

      <div className={styles.cardFoot}>
        <div className={styles.moveBtns}>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={() => onMove(-1)}
            disabled={index === 0}
            aria-label="Сдвинуть раньше"
            title="Сдвинуть раньше"
          >
            <ArrowLeft size={15} />
          </button>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={() => onMove(1)}
            disabled={index === count - 1}
            aria-label="Сдвинуть позже"
            title="Сдвинуть позже"
          >
            <ArrowRight size={15} />
          </button>
        </div>
        <button
          type="button"
          className={`${styles.iconBtn} ${styles.danger}`}
          onClick={onDelete}
          aria-label="Удалить"
          title="Удалить"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </article>
  );
}
