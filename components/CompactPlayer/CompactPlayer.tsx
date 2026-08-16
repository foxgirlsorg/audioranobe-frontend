'use client';

import React from 'react';
import { Maximize2, Pause, Play, RotateCcw, RotateCw } from 'lucide-react';
import { usePlayer } from '@/lib/player';
import styles from './CompactPlayer.module.css';

export default function CompactPlayer() {
  const { current, playing, position, duration, buffered, toggle, skip, full, setFull } = usePlayer();

  if (!current || full) return null;

  const max = duration > 0 ? duration : Math.max(position, 1);
  const playedPct = Math.min(100, (position / max) * 100);
  const bufferedPct = Math.min(100, Math.max(playedPct, (buffered / max) * 100));

  return (
    <div className={styles.bar}>
      <div className={styles.controls}>
        <div className={styles.center}>
          <button
            type="button"
            className={styles.ctrlBtn}
            onClick={() => skip(-10)}
            title={'Назад на 10 секунд'}
            aria-label={'Назад на 10 секунд'}
          >
            <RotateCcw />
            <span className={styles.skipNum}>10</span>
          </button>
          <button
            type="button"
            className={styles.ctrlBtn}
            onClick={toggle}
            title={playing ? 'Пауза' : 'Воспроизвести'}
            aria-label={playing ? 'Пауза' : 'Воспроизвести'}
          >
            {playing ? <Pause /> : <Play className={styles.playIcon} />}
          </button>
          <button
            type="button"
            className={styles.ctrlBtn}
            onClick={() => skip(10)}
            title={'Вперёд на 10 секунд'}
            aria-label={'Вперёд на 10 секунд'}
          >
            <RotateCw />
            <span className={styles.skipNum}>10</span>
          </button>
        </div>
        <button
          type="button"
          className={`${styles.ctrlBtn} ${styles.fsBtn}`}
          onClick={() => setFull(true)}
          title={'Во весь экран'}
          aria-label={'Во весь экран'}
        >
          <Maximize2 />
        </button>
      </div>

      <div
        className={styles.progress}
        style={
          {
            '--played': `${playedPct}%`,
            '--buffered': `${bufferedPct}%`,
          } as React.CSSProperties
        }
        aria-hidden="true"
      />
    </div>
  );
}
