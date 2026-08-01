'use client';

import { useCallback, useEffect, useState } from 'react';
import Cropper from 'react-easy-crop';
import { ImagePlus, ZoomIn, ZoomOut } from 'lucide-react';
import { useToast, errMsg } from '@/lib/toast';
import Modal from '@/components/Modal/Modal';
import styles from './ImageCropper.module.css';

type Area = { x: number; y: number; width: number; height: number };

const MAX_OUT_WIDTH = 1600;
const JPEG_QUALITY = 0.9;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('load-failed'));
    img.src = src;
  });
}

export function ImageCropper({
  open,
  onClose,
  aspect,
  title,
  onCropped,
  src,
  image,
  file,
}: {
  open: boolean;
  onClose: () => void;
  aspect: number;
  title?: string;
  onCropped: (blob: Blob) => void;
  src?: string | null;
  image?: string | null;
  file?: File | Blob | null;
}) {
  const { toast } = useToast();
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [areaPixels, setAreaPixels] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [pickedUrl, setPickedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setFileUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setFileUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setAreaPixels(null);
    setBusy(false);
    if (!open) {
      setPickedUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    }
  }, [open]);

  const imgSrc = fileUrl ?? src ?? image ?? pickedUrl ?? null;

  const onCropComplete = useCallback((_area: Area, pixels: Area) => {
    setAreaPixels(pixels);
  }, []);

  function pickFile(f: File | null) {
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      toast('Пожалуйста, выберите файл изображения', 'error');
      return;
    }
    setPickedUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(f);
    });
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setAreaPixels(null);
  }

  async function confirm() {
    if (!imgSrc || !areaPixels || busy) return;
    setBusy(true);
    try {
      const img = await loadImage(imgSrc).catch(() => {
        throw new Error('Не удалось загрузить изображение');
      });
      const scale = Math.min(1, MAX_OUT_WIDTH / areaPixels.width);
      const w = Math.max(1, Math.round(areaPixels.width * scale));
      const h = Math.max(1, Math.round(areaPixels.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas недоступен');
      ctx.drawImage(
        img,
        areaPixels.x,
        areaPixels.y,
        areaPixels.width,
        areaPixels.height,
        0,
        0,
        w,
        h
      );
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY)
      );
      if (!blob) throw new Error('Не удалось экспортировать изображение');
      onCropped(blob);
      onClose();
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={title ?? 'Обрезка изображения'}>
      {imgSrc ? (
        <>
          <div className={styles.cropArea}>
            <Cropper
              image={imgSrc}
              crop={crop}
              zoom={zoom}
              aspect={aspect}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
              showGrid={false}
            />
          </div>
          <div className={styles.zoomRow}>
            <ZoomOut size={15} className={styles.zoomIcon} />
            <input
              type="range"
              className={styles.zoom}
              min={1}
              max={4}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              aria-label={'Масштаб'}
            />
            <ZoomIn size={15} className={styles.zoomIcon} />
          </div>
          <div className={styles.actions}>
            {!file && !src && !image ? (
              <label className={styles.replace}>
                {'Заменить'}
                <input
                  type="file"
                  accept="image/*"
                  className={styles.fileInput}
                  onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
                />
              </label>
            ) : (
              <span />
            )}
            <div className={styles.actionsRight}>
              <button type="button" className={styles.cancel} onClick={onClose}>
                {'Отмена'}
              </button>
              <button
                type="button"
                className={styles.confirm}
                onClick={confirm}
                disabled={busy || !areaPixels}
              >
                {busy ? 'Сохраняем…' : 'Сохранить'}
              </button>
            </div>
          </div>
        </>
      ) : (
        <label className={styles.picker}>
          <ImagePlus size={28} />
          <span className={styles.pickerTitle}>{'Выберите изображение'}</span>
          <span className={styles.pickerHint}>{'JPEG, PNG или WebP'}</span>
          <input
            type="file"
            accept="image/*"
            className={styles.fileInput}
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
          />
        </label>
      )}
    </Modal>
  );
}

export default ImageCropper;
