'use client';

import React from 'react';
import { PhotoProvider, PhotoView } from '@/components/PhotoViewProvider/PhotoViewProvider';
import type { Illustration } from '@/lib/types';
import { groupIllustrations, viewerOverlay } from './illustrations';
import styles from './IllustrationGallery.module.css';

/**
 * The title page's "Иллюстрации" tab: justified rows, so every tile keeps its
 * own aspect ratio (nothing is cropped), rows fill the width, and order reads
 * left to right. Title-wide art first, then one group per chapter. Clicking
 * opens the image viewer, which pages through the whole gallery in this order.
 */
export default function IllustrationGallery({ items }: { items: Illustration[] }) {
  const groups = groupIllustrations(items);
  const showHeadings = groups.some((g) => g.heading !== null);

  return (
    // Its own provider, so the viewer pages through this gallery only — not
    // every other zoomable image on the page.
    <PhotoProvider>
      <div className={styles.gallery}>
        {groups.map((g) => (
          <section key={g.key} className={styles.group}>
            {showHeadings ? (
              <h3 className={styles.heading}>{g.heading ?? 'К тайтлу'}</h3>
            ) : null}
            <div className={styles.rows}>
              {g.items.map((ill) => {
                const ratio = ill.width / Math.max(1, ill.height);
                return (
                  <figure
                    key={ill.id}
                    className={styles.tile}
                    style={{
                      flexGrow: ratio,
                      flexBasis: `calc(${ratio} * var(--row-h))`,
                      // A row holding one tile would otherwise stretch it to the
                      // full width; cap the growth so a lone tile stays tile-sized.
                      maxWidth: `calc(${ratio} * var(--row-h) * 1.75)`,
                    }}
                  >
                    <PhotoView src={ill.url} overlay={viewerOverlay(ill, showHeadings)}>
                      <button
                        type="button"
                        className={styles.frame}
                        aria-label={ill.caption ? `Открыть: ${ill.caption}` : 'Открыть иллюстрацию'}
                      >
                        <img
                          src={ill.thumb_url}
                          alt={ill.caption}
                          width={ill.width}
                          height={ill.height}
                          style={{ aspectRatio: `${ill.width} / ${ill.height}` }}
                          loading="lazy"
                          decoding="async"
                        />
                      </button>
                    </PhotoView>
                    {ill.caption ? <figcaption className={styles.caption}>{ill.caption}</figcaption> : null}
                  </figure>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </PhotoProvider>
  );
}
