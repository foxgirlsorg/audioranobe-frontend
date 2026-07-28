'use client';

import Link from 'next/link';
import React, { useEffect, useRef, useState } from 'react';
import {
  Maximize2,
  Minimize2,
  Moon,
  Music,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { usePlayer } from '@/lib/player';
import { formatDuration } from '@/lib/format';
import styles from './Player.module.css';

const RATES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3];
const SLEEP_OPTIONS: { label: string; value: number | 'chapter' | null }[] = [
  { label: 'Выкл.', value: null },
  { label: '15 минут', value: 15 },
  { label: '30 минут', value: 30 },
  { label: '45 минут', value: 45 },
  { label: '60 минут', value: 60 },
  { label: 'До конца главы', value: 'chapter' },
];

export default function Player() {
  const {
    current,
    playing,
    position,
    duration,
    rate,
    volume,
    sleepRemaining,
    sleep,
    buffered,
    toggle,
    seek,
    skip,
    next,
    prev,
    setRate,
    setVolume,
    setSleep,
    stop,
  } = usePlayer();

  const [scrub, setScrub] = useState<number | null>(null);
  const [menu, setMenu] = useState<'rate' | 'sleep' | null>(null);
  const [full, setFull] = useState(false);
  const extrasRef = useRef<HTMLDivElement | null>(null);
  const lastVolumeRef = useRef(1);

  // close menus on outside click
  useEffect(() => {
    if (!menu) return;
    const onDown = (e: MouseEvent) => {
      if (extrasRef.current && !extrasRef.current.contains(e.target as Node)) setMenu(null);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menu]);

  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFull(false);
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [full]);

  // Closing the player should never leave the overlay stuck open.
  useEffect(() => {
    if (!current) setFull(false);
  }, [current]);

  if (!current) return null;

  const shown = scrub !== null ? scrub : position;
  const max = duration > 0 ? duration : Math.max(shown, 1);
  const playedPct = Math.min(100, (shown / max) * 100);
  const bufferedPct = Math.min(100, Math.max(playedPct, (buffered / max) * 100));

  const commitScrub = () => {
    if (scrub !== null) {
      seek(scrub);
      setScrub(null);
    }
  };

  const chapterLabel =
    `Том ${current.volume.number} · Гл. ${current.number}` +
    (current.name ? ` — ${current.name}` : '');

  const toggleMute = () => {
    if (volume > 0) {
      lastVolumeRef.current = volume;
      setVolume(0);
    } else {
      setVolume(lastVolumeRef.current || 1);
    }
  };

  return (
    <div className={full ? `${styles.bar} ${styles.barFull}` : styles.bar}>
      {full ? (
        <div className={styles.stage}>
          <button
            type="button"
            className={styles.stageClose}
            onClick={() => setFull(false)}
            title="Свернуть плеер"
            aria-label="Свернуть плеер"
          >
            <Minimize2 />
          </button>
          <Link href={`/title/${current.title.slug}`} className={styles.stageArt}>
            {current.title.cover_url ? (
              <img src={current.title.cover_url} alt="" />
            ) : (
              <Music size={64} aria-hidden="true" />
            )}
          </Link>
          <div className={styles.stageMeta}>
            <Link href={`/title/${current.title.slug}`} className={styles.stageTitle}>
              {current.title.name}
            </Link>
            <span className={styles.stageChapter}>{chapterLabel}</span>
          </div>
        </div>
      ) : null}

      <div className={styles.inner}>
        <div className={styles.seekRow}>
          <span className={styles.time}>{formatDuration(shown)}</span>
          <input
            className={styles.seek}
            type="range"
            min={0}
            max={max}
            step={0.1}
            value={Math.min(shown, max)}
            onChange={(e) => setScrub(parseFloat(e.target.value))}
            onPointerUp={commitScrub}
            onMouseUp={commitScrub}
            onTouchEnd={commitScrub}
            onKeyUp={commitScrub}
            style={
              {
                '--played': `${playedPct}%`,
                '--buffered': `${bufferedPct}%`,
              } as React.CSSProperties
            }
            aria-label={'Перемотка'}
          />
          <span className={styles.time}>{formatDuration(duration)}</span>
        </div>

        <div className={styles.row}>
          <div className={styles.info}>
            <Link
              href={`/title/${current.title.slug}`}
              className={styles.cover}
              title={current.title.name}
            >
              {current.title.cover_url ? (
                <img src={current.title.cover_url} alt="" />
              ) : (
                <Music aria-hidden="true" />
              )}
            </Link>
            <div className={styles.meta}>
              <span className={styles.chapter} title={chapterLabel}>
                {chapterLabel}
              </span>
              <Link href={`/title/${current.title.slug}`} className={styles.titleLink}>
                {current.title.name}
              </Link>
            </div>
          </div>

          <div className={styles.controls}>
            <button
              type="button"
              className={styles.ctrlBtn}
              onClick={prev}
              title={'Предыдущая глава'}
              aria-label={'Предыдущая глава'}
            >
              <SkipBack />
            </button>
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
              className={styles.playBtn}
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
            <button
              type="button"
              className={styles.ctrlBtn}
              onClick={next}
              disabled={!current.next_id}
              title={'Следующая глава'}
              aria-label={'Следующая глава'}
            >
              <SkipForward />
            </button>
          </div>

          <div className={styles.extras} ref={extrasRef}>
            <div className={styles.menuWrap}>
              <button
                type="button"
                className={`${styles.textBtn} ${rate !== 1 ? styles.textBtnActive : ''}`}
                onClick={() => setMenu(menu === 'rate' ? null : 'rate')}
                title={'Скорость воспроизведения'}
                aria-label={'Скорость воспроизведения'}
                aria-expanded={menu === 'rate'}
              >
                {rate}x
              </button>
              {menu === 'rate' && (
                <div className={styles.menu}>
                  <div className={styles.menuLabel}>{'Скорость'}</div>
                  {RATES.map((r) => (
                    <button
                      key={r}
                      type="button"
                      className={`${styles.menuItem} ${r === rate ? styles.menuItemActive : ''}`}
                      onClick={() => {
                        setRate(r);
                        setMenu(null);
                      }}
                    >
                      {r}x
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className={styles.menuWrap}>
              <button
                type="button"
                className={`${styles.iconBtn} ${sleep !== null ? styles.iconBtnActive : ''}`}
                onClick={() => setMenu(menu === 'sleep' ? null : 'sleep')}
                title={'Таймер сна'}
                aria-label={'Таймер сна'}
                aria-expanded={menu === 'sleep'}
              >
                <Moon />
                {sleep !== null && sleepRemaining !== null && (
                  <span className={styles.sleepLeft}>{formatDuration(sleepRemaining)}</span>
                )}
              </button>
              {menu === 'sleep' && (
                <div className={styles.menu}>
                  <div className={styles.menuLabel}>{'Таймер сна'}</div>
                  {SLEEP_OPTIONS.map((o) => (
                    <button
                      key={String(o.value)}
                      type="button"
                      className={`${styles.menuItem} ${
                        o.value === sleep ? styles.menuItemActive : ''
                      }`}
                      onClick={() => {
                        setSleep(o.value);
                        setMenu(null);
                      }}
                    >
                      {o.label}
                    </button>
                  ))}
                  {sleep !== null && sleepRemaining !== null && (
                    <div className={styles.menuFoot}>
                      {sleep === 'chapter' ? `${'До конца главы'} · ` : ''}
                      {`Осталось ${formatDuration(sleepRemaining)}`}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className={styles.volume}>
              <button
                type="button"
                className={styles.iconBtn}
                onClick={toggleMute}
                title={volume === 0 ? 'Включить звук' : 'Выключить звук'}
                aria-label={volume === 0 ? 'Включить звук' : 'Выключить звук'}
              >
                {volume === 0 ? <VolumeX /> : <Volume2 />}
              </button>
              <input
                className={styles.volumeSlider}
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                style={{ '--played': `${volume * 100}%` } as React.CSSProperties}
                aria-label={'Громкость'}
              />
            </div>

            <button
              type="button"
              className={styles.iconBtn}
              onClick={() => setFull((v) => !v)}
              title={full ? 'Свернуть плеер' : 'Во весь экран'}
              aria-label={full ? 'Свернуть плеер' : 'Во весь экран'}
              aria-pressed={full}
            >
              {full ? <Minimize2 /> : <Maximize2 />}
            </button>

            <button
              type="button"
              className={styles.iconBtn}
              onClick={stop}
              title={'Закрыть плеер'}
              aria-label={'Закрыть плеер'}
            >
              <X />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
