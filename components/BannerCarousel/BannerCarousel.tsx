'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '@/lib/api';
import type { Banner } from '@/lib/types';
import styles from './BannerCarousel.module.css';

const INTERVAL_MS = 10000;

export default function BannerCarousel() {
  const [banners, setBanners] = useState<Banner[]>([]);
  // Position in the cloned track: real slide i lives at position i + 1;
  // position 0 is a clone of the last slide, position count+1 clones the first.
  const [pos, setPos] = useState(1);
  const [animate, setAnimate] = useState(true);
  const paused = useRef(false);

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

  const count = banners.length;
  const step = useCallback((dir: 1 | -1) => {
    setPos((p) => p + dir);
  }, []);

  // Re-arm the transition on the frame after a no-transition snap, so the
  // snap itself paints first and doesn't get animated.
  useEffect(() => {
    if (animate) return;
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setAnimate(true)));
    return () => cancelAnimationFrame(raf);
  }, [animate]);

  useEffect(() => {
    if (count <= 1) return;
    const t = setInterval(() => {
      if (!paused.current) step(1);
    }, INTERVAL_MS);
    return () => clearInterval(t);
  }, [count, step]);

  // After sliding onto a clone, snap (no transition) back to the matching
  // real slide so the next step can keep going the same direction forever.
  const onTransitionEnd = () => {
    if (pos === 0) {
      setAnimate(false);
      setPos(count);
    } else if (pos === count + 1) {
      setAnimate(false);
      setPos(1);
    }
  };

  if (count === 0) return null;

  const track = count > 1 ? [banners[count - 1], ...banners, banners[0]] : banners;
  const active = count > 1 ? ((pos - 1 + count) % count) : 0;

  return (
    <div
      className={styles.wrap}
      onMouseEnter={() => {
        paused.current = true;
      }}
      onMouseLeave={() => {
        paused.current = false;
      }}
    >
      <div className={styles.viewport}>
        <div
          className={styles.track}
          style={{
            width: `${track.length * 100}%`,
            transform: `translateX(-${(pos * 100) / track.length}%)`,
            transition: animate ? undefined : 'none',
          }}
          onTransitionEnd={onTransitionEnd}
        >
          {track.map((b, i) => {
            const img = <img src={b.image_url} alt="" className={styles.img} loading={i === 1 ? 'eager' : 'lazy'} />;
            return (
              <div key={`${b.id}-${i}`} className={styles.slide} style={{ width: `${100 / track.length}%` }} aria-hidden={i !== pos}>
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
            <button type="button" className={`${styles.nav} ${styles.prev}`} onClick={() => step(-1)} aria-label="Предыдущий баннер">
              <ChevronLeft size={20} />
            </button>
            <button type="button" className={`${styles.nav} ${styles.next}`} onClick={() => step(1)} aria-label="Следующий баннер">
              <ChevronRight size={20} />
            </button>
            <div className={styles.dots} aria-hidden="true">
              {banners.map((b, i) => (
                <span key={b.id} className={i === active ? `${styles.dot} ${styles.dotOn}` : styles.dot} />
              ))}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
