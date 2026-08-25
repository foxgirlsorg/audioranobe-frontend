'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ExternalLink, ImagePlus } from 'lucide-react';
import { api } from '@/lib/api';
import { errMsg, useToast } from '@/lib/toast';
import { RELEASE_STATUS_LABELS, type Author, type ReleaseStatus, type TitleFull } from '@/lib/types';
import Modal from '@/components/Modal/Modal';
import Toggle from '@/components/Toggle/Toggle';
import Select, { type SelectOption } from '@/components/Select/Select';
import AuthorPicker from '@/components/AuthorPicker/AuthorPicker';
import GenrePicker from '@/components/GenrePicker/GenrePicker';
import styles from './TitleReviewModal.module.css';

// Lazily loaded: react-easy-crop only needs to load once a mod actually opens
// the crop dialog, not on every review-queue visit.
const ImageCropper = dynamic(() => import('@/components/ImageCropper/ImageCropper'), { ssr: false });

const CURRENT_YEAR = new Date().getFullYear();

const STATUS_OPTIONS: SelectOption<ReleaseStatus>[] = (
  Object.keys(RELEASE_STATUS_LABELS) as ReleaseStatus[]
).map((s) => ({ value: s, label: RELEASE_STATUS_LABELS[s] }));

type ImageKind = 'cover' | 'bg';

/**
 * The mod review queue's inspection surface: full-size, unblurred cover/bg
 * previews (the public title page deliberately darkens and blurs the banner,
 * which hides exactly the detail a mod needs to judge) with a click-to-zoom
 * lightbox and a replace button right on the image. Saves through the same
 * mod-only endpoints as the rest of the moderation panel — no narrator-team
 * membership required.
 */
export function TitleReviewModal({
  slug,
  onClose,
}: {
  slug: string | null;
  onClose: () => void;
}) {
  const { toast } = useToast();

  const [title, setTitle] = useState<TitleFull | null>(null);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const [zoom, setZoom] = useState<{ url: string; label: string } | null>(null);
  const [cropperKind, setCropperKind] = useState<ImageKind | null>(null);
  const [imageBusy, setImageBusy] = useState<ImageKind | null>(null);

  const [name, setName] = useState('');
  const [altNames, setAltNames] = useState('');
  const [description, setDescription] = useState('');
  const [year, setYear] = useState('');
  const [author, setAuthor] = useState<Author | null>(null);
  const [genreIds, setGenreIds] = useState<number[]>([]);
  const [status, setStatus] = useState<ReleaseStatus>('ongoing');
  const [isNsfw, setIsNsfw] = useState(false);
  const [isAi, setIsAi] = useState(false);

  useEffect(() => {
    if (slug === null) {
      setTitle(null);
      return;
    }
    let alive = true;
    setLoadError('');
    setTitle(null);
    api<TitleFull>(`/titles/${encodeURIComponent(slug)}`)
      .then((t) => {
        if (!alive) return;
        setTitle(t);
        setName(t.name);
        setAltNames((t.alt_names ?? []).join(', '));
        setDescription(t.description);
        setYear(t.year != null ? String(t.year) : '');
        setAuthor(t.author ? { ...t.author, titles_count: 0 } : null);
        setGenreIds(t.genres.map((g) => g.id));
        setStatus(t.release_status);
        setIsNsfw(t.is_nsfw);
        setIsAi(!!t.is_ai);
      })
      .catch((e) => {
        if (alive) setLoadError(errMsg(e));
      });
    return () => {
      alive = false;
    };
  }, [slug]);

  const save = async () => {
    if (!title) return;
    let yearNum: number | null = null;
    if (year.trim()) {
      const y = Number(year.trim());
      if (!Number.isInteger(y) || y < 0 || y > CURRENT_YEAR + 5) {
        toast('Похоже, год указан неверно', 'error');
        return;
      }
      yearNum = y;
    }
    setBusy(true);
    try {
      await api(`/mod/titles/${title.id}`, {
        method: 'PATCH',
        body: {
          name: name.trim(),
          alt_names: altNames.split(',').map((s) => s.trim()).filter(Boolean),
          author_id: author?.id ?? null,
          description,
          year: yearNum,
          release_status: status,
          genre_ids: genreIds,
          is_nsfw: isNsfw,
          is_ai: isAi,
        },
      });
      toast('Тайтл обновлён');
      onClose();
    } catch (e) {
      toast(errMsg(e), 'error');
    }
    setBusy(false);
  };

  const onCropped = async (blob: Blob) => {
    const kind = cropperKind;
    if (!title || !kind) return;
    const fd = new FormData();
    fd.append('file', blob, `${kind}.webp`);
    setImageBusy(kind);
    try {
      await api(`/panel/titles/${title.id}/${kind}`, { formData: fd });
      const fresh = await api<TitleFull>(`/titles/${encodeURIComponent(title.slug)}`);
      setTitle(fresh);
      toast(kind === 'cover' ? 'Обложка обновлена' : 'Фон обновлён');
    } catch (e) {
      toast(errMsg(e), 'error');
    }
    setImageBusy(null);
  };

  return (
    <>
      <Modal open={slug !== null} onClose={onClose} title={'Проверка тайтла'} size="wide">
        {loadError ? (
          <div className={styles.loadError}>{loadError}</div>
        ) : !title ? (
          <div className={styles.loading}>{'Загрузка…'}</div>
        ) : (
          <div className={styles.form}>
            <div className={styles.images}>
              <div
                className={`${styles.imageBox} ${styles.coverBox}`}
                onClick={() => title.cover_url && setZoom({ url: title.cover_url, label: 'Обложка' })}
              >
                {title.cover_url ? (
                  <img src={title.cover_url} alt="" className={styles.previewImg} />
                ) : (
                  <span className={styles.imageEmpty}>{'нет обложки'}</span>
                )}
                <div className={styles.imageOverlay}>
                  <button
                    type="button"
                    className={styles.overlayBtn}
                    disabled={imageBusy !== null}
                    onClick={(e) => {
                      e.stopPropagation();
                      setCropperKind('cover');
                    }}
                  >
                    <ImagePlus size={13} /> {'Заменить'}
                  </button>
                </div>
              </div>

              <div
                className={`${styles.imageBox} ${styles.bgBox}`}
                onClick={() => title.bg_url && setZoom({ url: title.bg_url, label: 'Фоновый баннер' })}
              >
                {title.bg_url ? (
                  <img src={title.bg_url} alt="" className={styles.previewImg} />
                ) : (
                  <span className={styles.imageEmpty}>{'нет фона'}</span>
                )}
                <div className={styles.imageOverlay}>
                  <button
                    type="button"
                    className={styles.overlayBtn}
                    disabled={imageBusy !== null}
                    onClick={(e) => {
                      e.stopPropagation();
                      setCropperKind('bg');
                    }}
                  >
                    <ImagePlus size={13} /> {'Заменить'}
                  </button>
                </div>
              </div>
            </div>

            <div className={styles.row}>
              <label className={styles.fieldLabel}>
                {'Название'}
                <input className="input" type="text" value={name} onChange={(e) => setName(e.target.value)} />
              </label>
              <label className={`${styles.fieldLabel} ${styles.narrow}`}>
                {'Год'}
                <input
                  className="input"
                  type="number"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  placeholder={String(CURRENT_YEAR)}
                />
              </label>
            </div>

            <label className={styles.fieldLabel}>
              {'Альтернативные названия (через запятую)'}
              <input
                className="input"
                type="text"
                value={altNames}
                onChange={(e) => setAltNames(e.target.value)}
              />
            </label>

            <div className={styles.row}>
              <label className={styles.fieldLabel}>
                {'Автор'}
                <AuthorPicker value={author} onChange={setAuthor} />
              </label>
              <label className={styles.fieldLabel}>
                {'Статус выпуска'}
                <Select<ReleaseStatus> value={status} options={STATUS_OPTIONS} onChange={setStatus} />
              </label>
            </div>

            <label className={styles.fieldLabel}>
              {'Описание'}
              <textarea
                className="textarea"
                rows={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>

            <label className={styles.fieldLabel}>
              {'Теги'}
              <GenrePicker value={genreIds} onChange={setGenreIds} />
            </label>

            <div className={styles.row}>
              <Toggle checked={isNsfw} onChange={setIsNsfw} label="18+ / чувствительный контент" disabled={busy} />
              <Toggle checked={isAi} onChange={setIsAi} label="Озвучено ИИ" disabled={busy} />
            </div>

            <div className={styles.note}>
              {'Чтецы: '}
              {title.narrators.length ? title.narrators.map((n) => n.name).join(', ') : '—'}
            </div>

            <div className={styles.actions}>
              <Link href={`/title/${title.slug}`} target="_blank" className="btn btn-ghost">
                <ExternalLink size={14} /> {'Открыть на сайте'}
              </Link>
              <span className={styles.spacer} />
              <button type="button" className="btn btn-ghost" onClick={onClose}>
                {'Отмена'}
              </button>
              <button type="button" className="btn" disabled={busy} onClick={() => void save()}>
                {'Сохранить'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={zoom !== null} onClose={() => setZoom(null)} title={zoom?.label}>
        {zoom ? <img src={zoom.url} alt="" className={styles.zoomImg} /> : null}
      </Modal>

      <ImageCropper
        open={cropperKind !== null}
        onClose={() => setCropperKind(null)}
        aspect={cropperKind === 'bg' ? 3 : 2 / 3}
        title={cropperKind === 'bg' ? 'Обрезка фона' : 'Обрезка обложки'}
        maxWidth={2048}
        maxHeight={2048}
        onCropped={onCropped}
      />
    </>
  );
}

export default TitleReviewModal;
