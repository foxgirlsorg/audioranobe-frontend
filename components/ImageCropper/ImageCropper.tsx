'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Cropper from 'react-easy-crop';
import { ImagePlus, ZoomIn, ZoomOut } from 'lucide-react';
import { useToast, errMsg } from '@/lib/toast';
import Modal from '@/components/Modal/Modal';
import styles from './ImageCropper.module.css';

type Area = { x: number; y: number; width: number; height: number };
type Rect = { left: number; top: number; width: number; height: number };

const WEBP_QUALITY = 0.85;

// The cover crop keeps mobile's 3:1 (see callers); PC renders a narrower centred
// slice of it. This is the aspect PC displays — used only to draw the guide band,
// never to change what gets cropped.
const COVER_PC_ASPECT = 4;

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
  overlay,
  maxWidth = 2048,
  maxHeight = Infinity,
}: {
  open: boolean;
  onClose: () => void;
  aspect: number;
  title?: string;
  onCropped: (blob: Blob) => void;
  src?: string | null;
  image?: string | null;
  file?: File | Blob | null;
  /** Guide drawn over the crop: a circle outline (avatars) or the PC/mobile
   *  cover bands. The crop itself is unchanged — this is purely a preview. */
  overlay?: 'circle' | 'cover';
  /** Output pixel cap, matching the server-side limit for this upload kind
   *  (see backend/src/lib/Img.php). Pass Infinity for an uncapped dimension. */
  maxWidth?: number;
  maxHeight?: number;
}) {
  const { toast } = useToast();
  const cropAreaRef = useRef<HTMLDivElement | null>(null);
  const [cropRect, setCropRect] = useState<Rect | null>(null);
  const [loadTick, setLoadTick] = useState(0);
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

  // Measure react-easy-crop's real crop box (it depends on media size, not just
  // the aspect) so the guide lands exactly on the crop, not the whole container.
  const measureCrop = useCallback(() => {
    if (!overlay) return;
    const area = cropAreaRef.current;
    if (!area) return;
    const cropEl = area.querySelector('[class*="reactEasyCrop_CropArea"]');
    if (!cropEl) return;
    const a = area.getBoundingClientRect();
    const r = cropEl.getBoundingClientRect();
    if (r.width < 4) return; // not laid out yet
    const next: Rect = { left: r.left - a.left, top: r.top - a.top, width: r.width, height: r.height };
    setCropRect((prev) =>
      prev &&
      Math.abs(prev.left - next.left) < 0.5 &&
      Math.abs(prev.top - next.top) < 0.5 &&
      Math.abs(prev.width - next.width) < 0.5 &&
      Math.abs(prev.height - next.height) < 0.5
        ? prev
        : next
    );
  }, [overlay]);

  // Re-measure on load, on modal open and on any container resize. Event-driven
  // (not a rAF loop), so it also settles while the tab isn't compositing.
  useEffect(() => {
    if (!overlay || !imgSrc) {
      setCropRect(null);
      return;
    }
    const area = cropAreaRef.current;
    if (!area) return;
    // react-easy-crop settles its crop box over a few frames after layout/load
    // without the container ever resizing, so neither a one-shot measure nor a
    // container ResizeObserver catches the final size. Poll briefly until the
    // box stops changing (fires even while the tab isn't compositing), then rely
    // on the ResizeObserver for later user-driven resizes.
    let lastKey = '';
    let stable = 0;
    measureCrop();
    const poll = window.setInterval(() => {
      measureCrop();
      const cropEl = area.querySelector('[class*="reactEasyCrop_CropArea"]');
      const r = cropEl?.getBoundingClientRect();
      const key = r ? `${Math.round(r.width)}x${Math.round(r.height)}` : '';
      if (key && key === lastKey) {
        if (++stable >= 3) window.clearInterval(poll);
      } else {
        stable = 0;
        lastKey = key;
      }
    }, 80);
    const stop = window.setTimeout(() => window.clearInterval(poll), 2500);
    const ro = new ResizeObserver(() => measureCrop());
    ro.observe(area);
    return () => {
      window.clearInterval(poll);
      window.clearTimeout(stop);
      ro.disconnect();
    };
  }, [overlay, imgSrc, loadTick, measureCrop]);

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
      const scale = Math.min(1, maxWidth / areaPixels.width, maxHeight / areaPixels.height);
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
        canvas.toBlob(resolve, 'image/webp', WEBP_QUALITY)
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
          <div className={styles.cropArea} ref={cropAreaRef}>
            <Cropper
              image={imgSrc}
              crop={crop}
              zoom={zoom}
              aspect={aspect}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
              onMediaLoaded={() => setLoadTick((n) => n + 1)}
              showGrid={false}
            />
            {overlay === 'circle' && cropRect ? (
              <div
                className={styles.circleGuide}
                style={{
                  left: cropRect.left,
                  top: cropRect.top,
                  width: cropRect.width,
                  height: cropRect.height,
                }}
              />
            ) : null}
            {overlay === 'cover' && cropRect ? (
              <div
                className={styles.coverGuide}
                style={{
                  left: cropRect.left,
                  top: cropRect.top,
                  width: cropRect.width,
                  height: cropRect.height,
                }}
              >
                <div
                  className={styles.coverPcBand}
                  style={{ height: cropRect.width / COVER_PC_ASPECT }}
                />
              </div>
            ) : null}
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
