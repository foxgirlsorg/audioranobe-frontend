'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { ImagePlus, X } from 'lucide-react';
import { api } from '@/lib/api';
import { useToast, errMsg } from '@/lib/toast';
import type { TitleFull, Volume } from '@/lib/types';
import styles from './TitleArtwork.module.css';

// Lazily loaded: react-easy-crop only needs to load once the user actually
// opens the crop dialog, not on every title page visit.
const ImageCropper = dynamic(() => import('@/components/ImageCropper/ImageCropper'), { ssr: false });

type Kind = 'cover' | 'bg' | { volumeId: number };

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
  const [removing, setRemoving] = useState<number | null>(null);

  async function onCropped(blob: Blob) {
    const kind = cropper;
    if (!kind) return;
    const fd = new FormData();
    fd.append('file', blob, 'cover.webp');
    const url =
      typeof kind === 'object'
        ? `/panel/volumes/${kind.volumeId}/cover`
        : `/panel/titles/${title.id}/${kind}`;
    setSaving(true);
    try {
      await api(url, { formData: fd });
      toast(typeof kind === 'object' ? 'Обложка тома обновлена' : kind === 'cover' ? 'Обложка обновлена' : 'Фон обновлён');
      await onReload();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function removeVolumeCover(volumeId: number) {
    setRemoving(volumeId);
    try {
      await api(`/panel/volumes/${volumeId}/cover`, { method: 'DELETE' });
      toast('Обложка тома удалена');
      await onReload();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setRemoving(null);
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

      {title.volumes.length > 0 ? (
        <div className={`glass-panel ${styles.card} ${styles.volumesCard}`}>
          <div className={styles.cardHead}>
            <span className={styles.label}>Обложки томов</span>
            <span className={styles.ratio}>2:3</span>
          </div>
          <p className={styles.hint}>
            Показывается в плеере, пока играет глава из этого тома. Без своей обложки том
            использует обложку тайтла.
          </p>
          <div className={styles.volumesGrid}>
            {title.volumes.map((v) => (
              <VolumeCoverItem
                key={v.id}
                volume={v}
                fallbackLabel={`${title.volume_label} ${v.number}`}
                saving={saving}
                removing={removing === v.id}
                onCrop={() => setCropper({ volumeId: v.id })}
                onRemove={() => void removeVolumeCover(v.id)}
                onReload={onReload}
              />
            ))}
          </div>
        </div>
      ) : null}

      <ImageCropper
        open={cropper !== null}
        onClose={() => setCropper(null)}
        aspect={cropper === 'bg' ? 3 : 2 / 3}
        title={cropper === 'bg' ? 'Обрезка фона' : typeof cropper === 'object' ? 'Обрезка обложки тома' : 'Обрезка обложки'}
        maxWidth={2048}
        maxHeight={2048}
        onCropped={onCropped}
      />
    </div>
  );
}

function VolumeCoverItem({
  volume,
  fallbackLabel,
  saving,
  removing,
  onCrop,
  onRemove,
  onReload,
}: {
  volume: Volume;
  fallbackLabel: string;
  saving: boolean;
  removing: boolean;
  onCrop: () => void;
  onRemove: () => void;
  onReload: () => Promise<void> | void;
}) {
  const { toast } = useToast();
  const [label, setLabel] = useState(volume.name || fallbackLabel);
  useEffect(() => setLabel(volume.name || fallbackLabel), [volume.name, fallbackLabel]);

  async function commit() {
    const current = volume.name || fallbackLabel;
    const next = label.trim() || fallbackLabel;
    if (next === current) {
      setLabel(next);
      return;
    }
    try {
      await api(`/panel/volumes/${volume.id}`, {
        method: 'PATCH',
        body: { name: next === fallbackLabel ? '' : next },
      });
      toast('Подпись обложки сохранена');
      await onReload();
    } catch (err) {
      setLabel(current);
      toast(errMsg(err), 'error');
    }
  }

  return (
    <div className={styles.volumeItem}>
      <div className={styles.stage}>
        <div className={styles.coverPreview}>
          {volume.cover_url ? (
            <img src={volume.cover_url} alt="" className={styles.previewImg} />
          ) : (
            <ImagePlus size={20} />
          )}
        </div>
        {volume.cover_url ? (
          <button
            type="button"
            className={styles.removeBtn}
            onClick={onRemove}
            disabled={removing}
            aria-label="Удалить обложку тома"
            title="Удалить обложку тома"
          >
            <X size={13} />
          </button>
        ) : null}
      </div>
      <input
        className={`input ${styles.volumeLabelInput}`}
        type="text"
        value={label}
        maxLength={300}
        aria-label="Подпись обложки"
        onChange={(e) => setLabel(e.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          if (e.key === 'Escape') {
            setLabel(volume.name || fallbackLabel);
            (e.target as HTMLInputElement).blur();
          }
        }}
      />
      <button
        type="button"
        className={`btn btn-ghost ${styles.actionSm}`}
        onClick={onCrop}
        disabled={saving}
      >
        <ImagePlus size={13} />
        {volume.cover_url ? 'Сменить' : 'Загрузить'}
      </button>
    </div>
  );
}
