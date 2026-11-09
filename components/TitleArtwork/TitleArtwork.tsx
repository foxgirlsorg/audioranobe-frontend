'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { ImagePlus, X } from 'lucide-react';
import ConfirmDialog from '@/components/ConfirmDialog/ConfirmDialog';
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
  const [confirmBg, setConfirmBg] = useState(false);

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

  async function removeBg() {
    setSaving(true);
    try {
      await api(`/panel/titles/${title.id}/bg`, { method: 'DELETE' });
      toast('Баннер удалён');
      setConfirmBg(false);
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
      <div className={`glass-panel ${styles.card} ${styles.mainCard}`}>
        <div className={styles.block}>
          <h3 className={styles.blockTitle}>Обложка</h3>
          <div className={styles.coverPreview}>
            {title.cover_url ? (
              <img src={title.cover_url} alt="" className={styles.previewImg} />
            ) : (
              <ImagePlus size={24} />
            )}
          </div>
          <div className={styles.actions}>
            <button
              type="button"
              className={`btn ${styles.actionFill}`}
              onClick={() => setCropper('cover')}
              disabled={saving}
            >
              {title.cover_url ? 'Заменить' : 'Загрузить обложку'}
            </button>
          </div>
        </div>

        <div className={styles.block}>
          <h3 className={styles.blockTitle}>Фоновый баннер</h3>
          <div className={styles.bgPreview}>
            {title.bg_url ? (
              <img src={title.bg_url} alt="" className={styles.previewImg} />
            ) : (
              <ImagePlus size={24} />
            )}
          </div>
          <div className={styles.actions}>
            <button
              type="button"
              className="btn"
              onClick={() => setCropper('bg')}
              disabled={saving}
            >
              {title.bg_url ? 'Заменить' : 'Загрузить баннер'}
            </button>
            {title.bg_url ? (
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => setConfirmBg(true)}
                disabled={saving}
              >
                Удалить
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {title.volumes.length > 0 ? (
        <div className={`glass-panel ${styles.card} ${styles.volumesCard}`}>
          <h3 className={styles.blockTitle}>Обложки томов</h3>
          <p className={styles.blockDesc}>
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

      <ConfirmDialog
        open={confirmBg}
        onClose={() => setConfirmBg(false)}
        onConfirm={() => void removeBg()}
        title="Удалить баннер?"
        body="Фоновый баннер будет удалён, шапка страницы тайтла останется без подложки."
        danger
      />

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
        className={`btn btn-sm ${styles.actionSm}`}
        onClick={onCrop}
        disabled={saving}
      >
        <ImagePlus size={13} />
        {volume.cover_url ? 'Сменить' : 'Загрузить'}
      </button>
    </div>
  );
}
