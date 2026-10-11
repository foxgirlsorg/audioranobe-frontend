'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '@/lib/api';
import { Modal } from '@/components/Modal/Modal';
import type { Banner } from '@/lib/types';
import styles from './BannerCarousel.module.css';

const INTERVAL_MS = 10000;


/** Banners sharing a group fill one slot (the first member's) with a random member. */
function pickGroups(list: Banner[]): Banner[] {
  const groups = new Map<string, Banner[]>();
  for (const b of list) if (b.group) groups.set(b.group, [...(groups.get(b.group) ?? []), b]);
  const done = new Set<string>();
  return list.flatMap((b) => {
    if (!b.group) return [b];
    if (done.has(b.group)) return [];
    done.add(b.group);
    const members = groups.get(b.group)!;
    return [members[Math.floor(Math.random() * members.length)]];
  });
}

export default function BannerCarousel({ initialBanners }: { initialBanners?: Banner[] } = {}) {
  const [all, setBanners] = useState<Banner[]>(initialBanners ?? []);
  const banners = useMemo(() => pickGroups(all), [all]);
  const [selected, setSelected] = useState(0);
  const [modal, setModal] = useState<{ title: string; html: string } | null>(null);
  const htmlRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // innerHTML never runs <script>; swapping each for a fresh element does.
    htmlRef.current?.querySelectorAll('script').forEach((old) => {
      const s = document.createElement('script');
      for (const a of Array.from(old.attributes)) s.setAttribute(a.name, a.value);
      s.text = old.text;
      old.replaceWith(s);
    });
  }, [modal]);
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, duration: 25 }, [
    Autoplay({ delay: INTERVAL_MS, stopOnInteraction: false, stopOnMouseEnter: true }),
  ]);

  useEffect(() => {
    if (initialBanners !== undefined) return;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
                {b.modal_html ? (
                  <button type="button" className={styles.link} onClick={() => setModal({ title: b.modal_title ?? '', html: b.modal_html! })}>
                    {img}
                  </button>
                ) : b.url ? (
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
      <Modal open={modal !== null} onClose={() => setModal(null)} title={modal?.title || undefined} size="wide">
        <div ref={htmlRef} className={styles.modalHtml} dangerouslySetInnerHTML={{ __html: modal?.html ?? '' }} />
      </Modal>
    </div>
  );
}
