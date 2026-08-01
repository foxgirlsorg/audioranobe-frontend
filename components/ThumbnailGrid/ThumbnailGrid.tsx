'use client';

import React, { useState } from 'react';
import ImageViewer from '@/components/ImageViewer/ImageViewer';
import styles from './ThumbnailGrid.module.css';

export default function ThumbnailGrid({ images }: { images: string[] }) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  return (
    <>
      <div className={styles.grid}>
        {images.map((url, i) => (
          <button
            key={url}
            type="button"
            className={styles.thumb}
            onClick={() => setActiveIdx(i)}
            aria-label={`Увеличить изображение ${i + 1}`}
          >
            <img src={url} alt={`Изображение ${i + 1}`} className={styles.img} />
          </button>
        ))}
      </div>
      <ImageViewer
        src={activeIdx != null ? images[activeIdx] : null}
        alt={activeIdx != null ? `Изображение ${activeIdx + 1}` : ''}
        open={activeIdx != null}
        onClose={() => setActiveIdx(null)}
      />
    </>
  );
}
