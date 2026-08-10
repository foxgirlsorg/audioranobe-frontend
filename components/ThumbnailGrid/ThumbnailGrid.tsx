'use client';

import React from 'react';
import { PhotoView } from 'react-photo-view';
import styles from './ThumbnailGrid.module.css';

export default function ThumbnailGrid({ images }: { images: string[] }) {
  return (
    <div className={styles.grid}>
      {images.map((url, i) => (
        <PhotoView key={url} src={url}>
          <button type="button" className={styles.thumb} aria-label={`Увеличить изображение ${i + 1}`}>
            <img src={url} alt={`Изображение ${i + 1}`} className={styles.img} />
          </button>
        </PhotoView>
      ))}
    </div>
  );
}
