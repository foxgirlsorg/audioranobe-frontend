'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { api, API_URL } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { ChapterPlay } from '@/lib/types';

interface PlayerContextValue {
  current: ChapterPlay | null;
  playing: boolean;
  position: number;
  duration: number;
  rate: number;
  volume: number;
  sleepRemaining: number | null;
  sleep: number | 'chapter' | null;
  buffered: number;
  playChapter(id: number): Promise<void>;
  toggle(): void;
  seek(s: number): void;
  skip(delta: number): void;
  next(): void;
  prev(): void;
  setRate(r: number): void;
  setVolume(v: number): void;
  setSleep(minutes: number | 'chapter' | null): void;
  stop(): void;
  barHidden: boolean;
  setBarHidden(hidden: boolean): void;
  full: boolean;
  setFull(full: boolean): void;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

const RATE_KEY = 'audioranobe_rate';
const VOL_KEY = 'audioranobe_volume';

export function PlayerProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [current, setCurrent] = useState<ChapterPlay | null>(null);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rate, setRateState] = useState(1);
  const [volume, setVolumeState] = useState(1);
  const [sleep, setSleepState] = useState<number | 'chapter' | null>(null);
  const [sleepRemaining, setSleepRemaining] = useState<number | null>(null);
  const [buffered, setBuffered] = useState(0);
  const [barHidden, setBarHidden] = useState(false);
  const [full, setFull] = useState(false);

  // Progress only persists for signed-in users. The cookie is HttpOnly so JS
  // can't sniff the session — mirror the auth user into a ref the memoised
  // saveProgress can read.
  const { user } = useAuth();
  const authedRef = useRef(false);
  useEffect(() => {
    authedRef.current = !!user;
  }, [user]);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentRef = useRef<ChapterPlay | null>(null);
  const rateRef = useRef(1);
  const volumeRef = useRef(1);
  const sleepRef = useRef<number | 'chapter' | null>(null);
  const sleepUntilRef = useRef(0);
  const endedRef = useRef<() => void>(() => {});
  const loadSeqRef = useRef(0);

  const saveProgress = useCallback((keepalive = false, positionOverride?: number) => {
    const cur = currentRef.current;
    const audio = audioRef.current;
    if (!cur || !audio) return;
    if (!authedRef.current) return;
    const pos = positionOverride !== undefined ? positionOverride : audio.currentTime;
    if (!Number.isFinite(pos)) return;
    try {
      fetch(`${API_URL}/me/progress/${cur.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ position: Math.max(0, pos) }),
        credentials: 'include',
        keepalive,
      }).catch(() => {});
    } catch {
    }
  }, []);

  const ensureAudio = useCallback((): HTMLAudioElement => {
    let audio = audioRef.current;
    if (audio) return audio;
    audio = new Audio();
    audio.preload = 'auto';
    audio.playbackRate = rateRef.current;
    audio.defaultPlaybackRate = rateRef.current;
    audio.volume = volumeRef.current;

    audio.addEventListener('timeupdate', () => {
      const a = audioRef.current;
      if (!a) return;
      setPosition(a.currentTime);
      if (sleepRef.current === 'chapter' && Number.isFinite(a.duration)) {
        setSleepRemaining(Math.max(0, a.duration - a.currentTime));
      }
    });
    audio.addEventListener('loadedmetadata', () => {
      const a = audioRef.current;
      if (a && Number.isFinite(a.duration) && a.duration > 0) setDuration(a.duration);
    });
    audio.addEventListener('durationchange', () => {
      const a = audioRef.current;
      if (a && Number.isFinite(a.duration) && a.duration > 0) setDuration(a.duration);
    });
    audio.addEventListener('progress', () => {
      const a = audioRef.current;
      if (!a) return;
      try {
        setBuffered(a.buffered.length ? a.buffered.end(a.buffered.length - 1) : 0);
      } catch {
        setBuffered(0);
      }
    });
    audio.addEventListener('play', () => setPlaying(true));
    audio.addEventListener('pause', () => {
      const a = audioRef.current;
      setPlaying(false);
      if (a && !a.ended && currentRef.current) saveProgress();
    });
    audio.addEventListener('ended', () => endedRef.current());
    audio.addEventListener('error', () => setPlaying(false));

    audioRef.current = audio;
    return audio;
  }, [saveProgress]);

  const playChapter = useCallback(
    async (id: number) => {
      const audio = ensureAudio();
      if (currentRef.current && currentRef.current.id === id && audio.src) {
        audio.play().catch(() => {});
        return;
      }
      if (currentRef.current && currentRef.current.id !== id) saveProgress();

      const seq = ++loadSeqRef.current;
      const ch = await api<ChapterPlay>(`/chapters/${id}`);
      if (seq !== loadSeqRef.current) return;

      currentRef.current = ch;
      setCurrent(ch);
      setBuffered(0);
      setDuration(ch.duration_seconds || 0);

      const start = Math.max(0, (ch.my_position ?? 0) - 10);
      setPosition(start);

      audio.src = ch.audio_url;
      audio.playbackRate = rateRef.current;
      audio.defaultPlaybackRate = rateRef.current;
      audio.volume = volumeRef.current;
      if (start > 0) {
        const onMeta = () => {
          audio.removeEventListener('loadedmetadata', onMeta);
          if (loadSeqRef.current !== seq) return;
          try {
            audio.currentTime = start;
          } catch {
          }
        };
        audio.addEventListener('loadedmetadata', onMeta);
      }
      try {
        await audio.play();
      } catch {
      }
    },
    [ensureAudio, saveProgress]
  );

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !currentRef.current) return;
    if (audio.paused) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, []);

  const seek = useCallback(
    (s: number) => {
      const audio = audioRef.current;
      const cur = currentRef.current;
      if (!audio || !cur) return;
      const d =
        Number.isFinite(audio.duration) && audio.duration > 0
          ? audio.duration
          : cur.duration_seconds || 0;
      const clamped = d > 0 ? Math.min(Math.max(0, s), d) : Math.max(0, s);
      try {
        audio.currentTime = clamped;
      } catch {
      }
      setPosition(clamped);
      saveProgress(false, clamped);
    },
    [saveProgress]
  );

  const skip = useCallback(
    (delta: number) => {
      const audio = audioRef.current;
      if (!audio || !currentRef.current) return;
      seek(audio.currentTime + delta);
    },
    [seek]
  );

  const next = useCallback(() => {
    const cur = currentRef.current;
    if (cur?.next_id) playChapter(cur.next_id).catch(() => {});
  }, [playChapter]);

  const prev = useCallback(() => {
    const cur = currentRef.current;
    if (!cur) return;
    if (cur.prev_id) playChapter(cur.prev_id).catch(() => {});
    else seek(0);
  }, [playChapter, seek]);

  const setRate = useCallback((r: number) => {
    const clamped = Math.min(3, Math.max(0.5, r));
    rateRef.current = clamped;
    setRateState(clamped);
    const audio = audioRef.current;
    if (audio) {
      audio.playbackRate = clamped;
      audio.defaultPlaybackRate = clamped;
    }
    try {
      localStorage.setItem(RATE_KEY, String(clamped));
    } catch {
    }
  }, []);

  const setVolume = useCallback((v: number) => {
    const clamped = Math.min(1, Math.max(0, v));
    volumeRef.current = clamped;
    setVolumeState(clamped);
    const audio = audioRef.current;
    if (audio) audio.volume = clamped;
    try {
      localStorage.setItem(VOL_KEY, String(clamped));
    } catch {
    }
  }, []);

  const setSleep = useCallback((minutes: number | 'chapter' | null) => {
    sleepRef.current = minutes;
    setSleepState(minutes);
    if (minutes === null) {
      sleepUntilRef.current = 0;
      setSleepRemaining(null);
    } else if (minutes === 'chapter') {
      sleepUntilRef.current = 0;
      const audio = audioRef.current;
      if (audio && Number.isFinite(audio.duration) && audio.duration > 0) {
        setSleepRemaining(Math.max(0, audio.duration - audio.currentTime));
      } else {
        setSleepRemaining(null);
      }
    } else {
      sleepUntilRef.current = Date.now() + minutes * 60_000;
      setSleepRemaining(minutes * 60);
    }
  }, []);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    loadSeqRef.current++;
    if (audio && currentRef.current) {
      saveProgress();
      audio.pause();
      audio.removeAttribute('src');
      try {
        audio.load();
      } catch {
      }
    }
    currentRef.current = null;
    setCurrent(null);
    setPlaying(false);
    setPosition(0);
    setDuration(0);
    setBuffered(0);
    sleepRef.current = null;
    sleepUntilRef.current = 0;
    setSleepState(null);
    setSleepRemaining(null);
  }, [saveProgress]);

  const handleEnded = useCallback(() => {
    const cur = currentRef.current;
    if (!cur) return;
    const audio = audioRef.current;
    const endPos =
      audio && Number.isFinite(audio.duration) && audio.duration > 0
        ? audio.duration
        : cur.duration_seconds || 0;
    saveProgress(false, endPos);

    if (sleepRef.current === 'chapter') {
      sleepRef.current = null;
      setSleepState(null);
      setSleepRemaining(null);
      setPlaying(false);
      return;
    }
    if (cur.next_id) {
      playChapter(cur.next_id).catch(() => setPlaying(false));
    } else {
      setPlaying(false);
    }
  }, [playChapter, saveProgress]);

  useEffect(() => {
    endedRef.current = handleEnded;
  }, [handleEnded]);

  useEffect(() => {
    try {
      const r = parseFloat(localStorage.getItem(RATE_KEY) || '');
      if (Number.isFinite(r) && r >= 0.5 && r <= 3) {
        rateRef.current = r;
        setRateState(r);
      }
      const v = parseFloat(localStorage.getItem(VOL_KEY) || '');
      if (Number.isFinite(v) && v >= 0 && v <= 1) {
        volumeRef.current = v;
        setVolumeState(v);
      }
    } catch {
    }
  }, []);

  useEffect(() => {
    if (!playing) return;
    const iv = window.setInterval(() => saveProgress(), 10000);
    return () => window.clearInterval(iv);
  }, [playing, saveProgress]);

  useEffect(() => {
    const handler = () => saveProgress(true);
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [saveProgress]);

  useEffect(() => {
    if (typeof sleep !== 'number') return;
    const iv = window.setInterval(() => {
      const remaining = Math.max(0, Math.round((sleepUntilRef.current - Date.now()) / 1000));
      setSleepRemaining(remaining);
      if (remaining <= 0) {
        audioRef.current?.pause();
        sleepRef.current = null;
        sleepUntilRef.current = 0;
        setSleepState(null);
        setSleepRemaining(null);
      }
    }, 1000);
    return () => window.clearInterval(iv);
  }, [sleep]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === 'INPUT' ||
          t.tagName === 'TEXTAREA' ||
          t.tagName === 'SELECT' ||
          t.isContentEditable)
      ) {
        return;
      }
      if (!currentRef.current) return;
      if (e.code === 'Space') {
        e.preventDefault();
        toggle();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        skip(-10);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        skip(10);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle, skip]);

  useEffect(() => {
    document.body.classList.toggle('has-player', !!current && !barHidden);
    return () => {
      document.body.classList.remove('has-player');
    };
  }, [current, barHidden]);

  const value = useMemo<PlayerContextValue>(
    () => ({
      current,
      playing,
      position,
      duration,
      rate,
      volume,
      sleepRemaining,
      sleep,
      buffered,
      playChapter,
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
      setBarHidden,
      full,
      setFull,
    }),
    [
      current,
      playing,
      position,
      duration,
      rate,
      volume,
      sleepRemaining,
      sleep,
      buffered,
      playChapter,
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
    ]
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer(): PlayerContextValue {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used inside <PlayerProvider>');
  return ctx;
}
