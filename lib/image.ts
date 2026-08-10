/**
 * Client-side downscale + webp re-encode, run before every image upload so
 * the server rarely has to reject on pixel size (see backend/src/lib/Img.php
 * for the matching caps) and so covers/avatars ship small.
 */

const WEBP_QUALITY = 0.85;

function loadBitmap(blob: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) {
    return createImageBitmap(blob);
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('load-failed'));
    };
    img.src = url;
  });
}

/**
 * Downscales `source` to fit within maxWidth × maxHeight (contain, never
 * upscales) and re-encodes it as webp. Pass `Infinity` for a dimension that
 * shouldn't be capped (e.g. wide banners are width-only).
 */
export async function resizeToWebp(
  source: Blob,
  maxWidth: number,
  maxHeight: number,
  quality: number = WEBP_QUALITY
): Promise<Blob> {
  const bitmap = await loadBitmap(source);
  const srcW = bitmap.width;
  const srcH = bitmap.height;
  const scale = Math.min(1, maxWidth / srcW, maxHeight / srcH);
  const w = Math.max(1, Math.round(srcW * scale));
  const h = Math.max(1, Math.round(srcH * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas недоступен');
  ctx.drawImage(bitmap as CanvasImageSource, 0, 0, w, h);
  if ('close' in bitmap) bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/webp', quality)
  );
  if (!blob) throw new Error('Не удалось экспортировать изображение');
  return blob;
}
