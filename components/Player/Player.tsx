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
  Share2,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { usePlayer, usePlayerPosition } from '@/lib/player';
import { chapterNumberLabel, formatDuration } from '@/lib/format';
import { useAnimatedPresence } from '@/lib/useAnimatedPresence';
import { useBackToClose } from '@/lib/useBackToClose';
import { useToast, errMsg } from '@/lib/toast';
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
    current: liveCurrent,
    playing,
    duration,
    rate,
    volume,
    sleepRemaining,
    sleep,
    toggle,
    seek,
    skip,
    next,
    prev,
    setRate,
    setVolume,
    setSleep,
    stop,
    barHidden,
    full,
    setFull,
  } = usePlayer();
  const { position, buffered } = usePlayerPosition();
  const { toast } = useToast();

  const [scrub, setScrub] = useState<number | null>(null);
  const [menu, setMenu] = useState<'rate' | 'sleep' | null>(null);
  const [chapterOverflow, setChapterOverflow] = useState(false);
  const extrasRef = useRef<HTMLDivElement | null>(null);
  const oneRowRef = useRef<HTMLDivElement | null>(null);
  const lastVolumeRef = useRef(1);
  const stageChapterRef = useRef<HTMLSpanElement | null>(null);
  const stageChapterTrackRef = useRef<HTMLSpanElement | null>(null);
  // Both the whole full-screen overlay and its .stage content stay mounted
  // a beat past `full` going false so their exit (slide-down / fade-out)
  // animations get to play instead of the layout just snapping back to
  // docked.
  const fullMounted = useAnimatedPresence(full, 360);
  const stageMounted = useAnimatedPresence(full, 360);

  useBackToClose(full, () => setFull(false));

  // The docked bar slides up when a track first starts and slides back down
  // when playback stops. `active` is "the bar should be visible"; keeping it
  // mounted a beat past that (activeMounted) lets the slide-out play, and
  // retaining the last track (lastCurrentRef) keeps the markup renderable
  // during that exit even after the context's current has gone null.
  const active = !!liveCurrent && (!barHidden || full);
  const activeMounted = useAnimatedPresence(active, 360);
  const lastCurrentRef = useRef(liveCurrent);
  if (liveCurrent) lastCurrentRef.current = liveCurrent;
  const current = liveCurrent ?? lastCurrentRef.current;

  // Play the slide-up on every genuine appearance (track starts, or the bar
  // was hidden and comes back) — but not on the collapse from full-screen
  // back to docked, which is the same element staying mounted throughout.
  // `entered` flips true 360ms after each appearance so the animation class
  // gets dropped once it's done, and resets back to false the moment the bar
  // goes inactive so the NEXT appearance replays it instead of just popping
  // in — without this reset it only ever animated once, the very first time.
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    if (!active) {
      setEntered(false);
      return;
    }
    const t = window.setTimeout(() => setEntered(true), 360);
    return () => window.clearTimeout(t);
  }, [active]);

  useEffect(() => {
    if (!menu) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (extrasRef.current?.contains(t) || oneRowRef.current?.contains(t)) return;
      setMenu(null);
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

  useEffect(() => {
    if (!current) setFull(false);
  }, [current]);

  useEffect(() => {
    if (!full) return;
    const el = stageChapterRef.current;
    const track = stageChapterTrackRef.current;
    if (!el || !track) return;
    setChapterOverflow(track.scrollWidth / 2 > el.clientWidth);
  }, [full, current]);

  if (!current) return null;
  if (!activeMounted) return null;

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
    `Том ${current.volume.number} · Гл. ${chapterNumberLabel(current.number, current.number_end)}` +
    (current.name ? ` — ${current.name}` : '');

  const toggleMute = () => {
    if (volume > 0) {
      lastVolumeRef.current = volume;
      setVolume(0);
    } else {
      setVolume(lastVolumeRef.current || 1);
    }
  };

  const share = async () => {
    const at = Math.round(scrub !== null ? scrub : position);
    const url = `${window.location.origin}/chapter/${current.id}?t=${at}`;
    try {
      await navigator.clipboard.writeText(url);
      toast(`Ссылка на ${formatDuration(at)} скопирована`, 'ok');
    } catch (e) {
      toast(errMsg(e), 'error');
    }
  };

  // Each control is defined once and dropped into both layouts below (the
  // wide/wrapped set and the single-row set); CSS shows exactly one set at a
  // time, so the duplicated JSX only ever renders one live instance.
  const prevBtn = (
    <button
      type="button"
      className={styles.ctrlBtn}
      onClick={prev}
      title={'Предыдущая глава'}
      aria-label={'Предыдущая глава'}
    >
      <SkipBack />
    </button>
  );
  const back10Btn = (
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
  );
  const playPauseBtn = (
    <button
      type="button"
      className={styles.playBtn}
      onClick={toggle}
      title={playing ? 'Пауза' : 'Воспроизвести'}
      aria-label={playing ? 'Пауза' : 'Воспроизвести'}
    >
      {playing ? <Pause /> : <Play className={styles.playIcon} />}
    </button>
  );
  const fwd10Btn = (
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
  );
  const nextBtn = (
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
  );
  const speedControl = (
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
  );
  const sleepControl = (
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
              className={`${styles.menuItem} ${o.value === sleep ? styles.menuItemActive : ''}`}
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
  );
  const muteControl = (
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
        aria-valuetext={`${Math.round(volume * 100)}%`}
      />
    </div>
  );
  const fullscreenBtn = (
    <button
      type="button"
      className={styles.iconBtn}
      onClick={() => setFull(!full)}
      title={full ? 'Свернуть плеер' : 'Во весь экран'}
      aria-label={full ? 'Свернуть плеер' : 'Во весь экран'}
      aria-pressed={full}
    >
      {full ? <Minimize2 /> : <Maximize2 />}
    </button>
  );
  const closeBtn = (
    <button
      type="button"
      className={styles.iconBtn}
      onClick={stop}
      title={'Закрыть плеер'}
      aria-label={'Закрыть плеер'}
    >
      <X />
    </button>
  );

  let barCls: string;
  if (fullMounted) {
    barCls = `${styles.bar} ${styles.barFull} ${full ? styles.barOpen : styles.barClosing}`;
  } else if (!active) {
    barCls = `${styles.bar} ${styles.dockOut}`;
  } else if (!entered) {
    barCls = `${styles.bar} ${styles.dockIn}`;
  } else {
    barCls = styles.bar;
  }

  return (
    <div className={barCls}>
      {stageMounted ? (
        <div className={full ? styles.stage : `${styles.stage} ${styles.stageOut}`}>
          <button
            type="button"
            className={styles.stageShare}
            onClick={() => void share()}
            title="Поделиться с этого места"
            aria-label="Поделиться с этого места"
          >
            <Share2 />
          </button>
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
            <span
              className={
                chapterOverflow
                  ? `${styles.stageChapter} ${styles.stageChapterMarquee}`
                  : `${styles.stageChapter} ${styles.stageChapterStatic}`
              }
              ref={stageChapterRef}
            >
              {chapterOverflow ? (
                <span className={styles.stageChapterTrack} ref={stageChapterTrackRef}>
                  <span>{chapterLabel}</span>
                  <span>{chapterLabel}</span>
                </span>
              ) : (
                <span className={styles.stageChapterTrack} ref={stageChapterTrackRef}>
                  {chapterLabel}
                </span>
              )}
            </span>
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
            aria-valuetext={formatDuration(shown)}
          />
          <span className={styles.time}>{formatDuration(duration)}</span>
        </div>

        <div className={styles.row} ref={extrasRef}>
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
            {prevBtn}
            {back10Btn}
            {playPauseBtn}
            {fwd10Btn}
            {nextBtn}
          </div>

          <div className={styles.extras}>
            {speedControl}
            {sleepControl}
            {muteControl}
            {fullscreenBtn}
            {closeBtn}
          </div>
        </div>

        <div className={styles.oneRow} ref={oneRowRef}>
          {speedControl}
          {closeBtn}
          {prevBtn}
          {back10Btn}
          {playPauseBtn}
          {fwd10Btn}
          {nextBtn}
          {sleepControl}
          {fullscreenBtn}
        </div>
      </div>
    </div>
  );
}
