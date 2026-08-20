'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { ImagePlus } from 'lucide-react';
import { api } from '@/lib/api';
import { useToast, errMsg } from '@/lib/toast';
import type { TitleFull } from '@/lib/types';
import styles from './TitleArtwork.module.css';

// Lazily loaded: react-easy-crop only needs to load once the user actually
// opens the crop dialog, not on every title page visit.
const ImageCropper = dynamic(() => import('@/components/ImageCropper/ImageCropper'), { ssr: false });

type Kind = 'cover' | 'bg';

export default function TitleArtwork({
  title,
  onReload,
}: {
  title: TitleFull;
  onReload: () => Promise<void> | void;
}) {
  const { toast } = useToast();
  const [cropper, setCropper] = useState<Kind | null>(null);
  const [saving, setSaving] = useState(false);

  async function onCropped(blob: Blob) {
    const kind = cropper;
    if (!kind) return;
    const fd = new FormData();
    fd.append('file', blob, `${kind}.webp`);
    setSaving(true);
    try {
      await api(`/panel/titles/${title.id}/${kind}`, { formData: fd });
      toast(kind === 'cover' ? 'Обложка обновлена' : 'Фон обновлён');
      await onReload();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={`glass-panel ${styles.card}`}>
        <div className={styles.cardHead}>
          <span className={styles.label}>Обложка</span>
          <span className={styles.ratio}>2:3</span>
        </div>
        <div className={styles.stage}>
          <div className={styles.coverPreview}>
            {title.cover_url ? (
              <img src={title.cover_url} alt="" className={styles.previewImg} />
            ) : (
              <ImagePlus size={24} />
            )}
          </div>
        </div>
        <p className={styles.hint}>
          Показывается в каталоге и на карточках. Лучше всего — вертикальное изображение от 600
          пикселей по ширине.
        </p>
        <button
          type="button"
          className={`btn ${styles.action}`}
          onClick={() => setCropper('cover')}
          disabled={saving}
        >
          <ImagePlus size={15} />
          {title.cover_url ? 'Сменить обложку' : 'Загрузить обложку'}
        </button>
      </div>

      <div className={`glass-panel ${styles.card}`}>
        <div className={styles.cardHead}>
          <span className={styles.label}>Фоновый баннер</span>
          <span className={styles.ratio}>3:1</span>
        </div>
        <div className={styles.stage}>
          <div className={styles.bgPreview}>
            {title.bg_url ? (
              <img src={title.bg_url} alt="" className={styles.previewImg} />
            ) : (
              <ImagePlus size={24} />
            )}
          </div>
        </div>
        <p className={styles.hint}>
          Широкая подложка в шапке страницы тайтла. Она затемняется и размывается, поэтому мелкие
          детали и текст на ней не читаются.
        </p>
        <button
          type="button"
          className={`btn ${styles.action}`}
          onClick={() => setCropper('bg')}
          disabled={saving}
        >
          <ImagePlus size={15} />
          {title.bg_url ? 'Сменить фон' : 'Загрузить фон'}
        </button>
      </div>

      <ImageCropper
        open={cropper !== null}
        onClose={() => setCropper(null)}
        aspect={cropper === 'bg' ? 3 : 2 / 3}
        title={cropper === 'bg' ? 'Обрезка фона' : 'Обрезка обложки'}
        maxWidth={2048}
        maxHeight={2048}
        onCropped={onCropped}
      />
    </div>
  );
}
