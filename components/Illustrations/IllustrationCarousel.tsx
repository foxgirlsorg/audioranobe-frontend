'use client';

import React, { useCallback, useEffect, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PhotoProvider, PhotoView } from '@/components/PhotoViewProvider/PhotoViewProvider';
import type { Illustration } from '@/lib/types';
import { viewerOverlay } from './illustrations';
import styles from './IllustrationCarousel.module.css';

/**
 * The full-screen player's artwork when the current chapter has illustrations:
 * a swipeable carousel built like the home-page banners, minus the autoplay.
 *
 * Illustrations come in any aspect ratio, so every slide is a fixed box: the
 * image sits contain-fit on top of a blurred, cover-fit copy of itself — tall
 * portraits and wide panoramas both fill the frame without cropping and
 * without dead black bars. Clicking opens the image viewer.
 */
export default function IllustrationCarousel({
  items,
  revealed = false,
}: {
  items: Illustration[];
  /** Unblurs every illustration client-side once the listener crosses the chapter's midpoint, without waiting for a refetch. */
  revealed?: boolean;
}) {
  const many = items.length > 1;
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: many, duration: 25, watchDrag: many });
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setSelected(emblaApi.selectedScrollSnap());
    onSelect();
    emblaApi.on('select', onSelect);
    emblaApi.on('reInit', onSelect);
    return () => {
      emblaApi.off('select', onSelect);
      emblaApi.off('reInit', onSelect);
    };
  }, [emblaApi]);

  // A new chapter brings a new set — start it from its first illustration.
  const ids = items.map((i) => i.id).join(',');
  useEffect(() => {
    emblaApi?.scrollTo(0, true);
  }, [emblaApi, ids]);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  return (
    // Its own provider: the viewer pages through this chapter's set only.
    <PhotoProvider>
      <div className={styles.wrap}>
        <div className={styles.viewport} ref={emblaRef}>
          <div className={styles.track}>
            {items.map((ill, i) => (
              <div key={ill.id} className={styles.slide} aria-roledescription="слайд" aria-label={`${i + 1} из ${items.length}`}>
                <img className={styles.backdrop} src={ill.thumb_url} alt="" aria-hidden="true" />
                <PhotoView src={ill.url} overlay={viewerOverlay(ill, false)}>
                  <img
                    className={ill.blurred && !revealed ? `${styles.img} ${styles.blurred}` : styles.img}
                    src={ill.url}
                    alt={ill.caption}
                    draggable={false}
                    loading={i === 0 ? 'eager' : 'lazy'}
                  />
                </PhotoView>
                {ill.caption ? <div className={styles.caption}>{ill.caption}</div> : null}
              </div>
            ))}
          </div>

          {many ? (
            <>
              <button type="button" className={`${styles.nav} ${styles.prev}`} onClick={scrollPrev} aria-label="Предыдущая иллюстрация">
                <ChevronLeft size={20} />
              </button>
              <button type="button" className={`${styles.nav} ${styles.next}`} onClick={scrollNext} aria-label="Следующая иллюстрация">
                <ChevronRight size={20} />
              </button>
            </>
          ) : null}
        </div>

        {many ? (
          <div className={styles.dots}>
            {items.map((ill, i) => (
              <button
                key={ill.id}
                type="button"
                className={i === selected ? `${styles.dot} ${styles.dotOn}` : styles.dot}
                onClick={() => emblaApi?.scrollTo(i)}
                aria-label={`Иллюстрация ${i + 1}`}
                aria-current={i === selected}
              />
            ))}
          </div>
        ) : null}
      </div>
    </PhotoProvider>
  );
}
