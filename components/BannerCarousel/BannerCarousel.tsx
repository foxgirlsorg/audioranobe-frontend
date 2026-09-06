'use client';

import { useCallback, useEffect, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '@/lib/api';
import type { Banner } from '@/lib/types';
import styles from './BannerCarousel.module.css';

const INTERVAL_MS = 10000;

export default function BannerCarousel() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [selected, setSelected] = useState(0);
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, duration: 25 }, [
    Autoplay({ delay: INTERVAL_MS, stopOnInteraction: false, stopOnMouseEnter: true }),
  ]);

  useEffect(() => {
    let alive = true;
    api<{ items: Banner[] }>('/banners')
      .then((d) => {
        if (alive) setBanners(d.items);
      })
      .catch(() => {
      });
    return () => {
      alive = false;
    };
  }, []);

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

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);
  const scrollTo = useCallback((i: number) => emblaApi?.scrollTo(i), [emblaApi]);

  if (banners.length === 0) return null;
  const count = banners.length;

  return (
    <div className={styles.wrap}>
      <div className={styles.viewport} ref={emblaRef}>
        <div className={styles.track}>
          {banners.map((b, i) => {
            const img = <img src={b.image_url} alt="" className={styles.img} loading={i === 0 ? 'eager' : 'lazy'} />;
            return (
              <div key={b.id} className={styles.slide}>
                {b.url ? (
                  <a href={b.url} className={styles.link} target="_blank" rel="noopener noreferrer">
                    {img}
                  </a>
                ) : (
                  img
                )}
              </div>
            );
          })}
        </div>

        {count > 1 ? (
          <>
            <button type="button" className={`${styles.nav} ${styles.prev}`} onClick={scrollPrev} aria-label="Предыдущий баннер">
              <ChevronLeft size={20} />
            </button>
            <button type="button" className={`${styles.nav} ${styles.next}`} onClick={scrollNext} aria-label="Следующий баннер">
              <ChevronRight size={20} />
            </button>
            <div className={styles.dots} aria-hidden="true">
              {banners.map((b, i) => (
                <span
                  key={b.id}
                  className={i === selected ? `${styles.dot} ${styles.dotOn}` : styles.dot}
                  onClick={() => scrollTo(i)}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
