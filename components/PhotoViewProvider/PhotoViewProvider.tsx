'use client';

// react-photo-view ships no 'use client' directive of its own, so importing
// it straight into a server component (app/layout.tsx) puts it in the RSC
// bundle, where the trimmed-down 'react' export has no createContext. This
// wrapper is the client boundary that keeps it on the client, and also owns
// the toolbar so app/layout.tsx (a server component) never has to pass a
// function prop across the boundary.

import React from 'react';
import { PhotoProvider as BasePhotoProvider } from 'react-photo-view';
import { ZoomIn, ZoomOut, RotateCw, Download } from 'lucide-react';
import styles from './PhotoViewProvider.module.css';

export { PhotoView } from 'react-photo-view';

export function PhotoProvider({ children }: { children: React.ReactNode }) {
  return (
    <BasePhotoProvider
      maskOpacity={1}
      bannerVisible
      toolbarRender={({ scale, onScale, rotate, onRotate, images, index }) => {
        const src = images[index]?.src;
        return (
          <>
            <button
              type="button"
              className={styles.btn}
              onClick={() => onScale(scale - 0.5)}
              aria-label="Уменьшить"
              title="Уменьшить"
            >
              <ZoomOut size={18} />
            </button>
            <button
              type="button"
              className={styles.btn}
              onClick={() => onScale(scale + 0.5)}
              aria-label="Увеличить"
              title="Увеличить"
            >
              <ZoomIn size={18} />
            </button>
            <button
              type="button"
              className={styles.btn}
              onClick={() => onRotate(rotate + 90)}
              aria-label="Повернуть"
              title="Повернуть"
            >
              <RotateCw size={18} />
            </button>
            {src ? (
              <a
                className={styles.btn}
                href={src}
                download
                target="_blank"
                rel="noreferrer"
                aria-label="Скачать"
                title="Скачать"
              >
                <Download size={18} />
              </a>
            ) : null}
          </>
        );
      }}
    >
      {children}
    </BasePhotoProvider>
  );
}
