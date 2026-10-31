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
import { useToast } from '@/lib/toast';
import { chapterLabel } from '@/lib/format';
import type { ChapterPlay } from '@/lib/types';
import { useTtsMode, type TtsMode } from '@/lib/ttsMode';

interface PlayerContextValue {
  current: ChapterPlay | null;
  playing: boolean;
  duration: number;
  rate: number;
  volume: number;
  sleepRemaining: number | null;
  sleep: number | 'chapter' | null;
  playChapter(id: number, startAt?: number): Promise<void>;
  /** Narrate the chapter's stored text in the browser instead of playing its audio. */
  playTts(id: number, startAt?: number): Promise<void>;
  mode: 'audio' | 'tts';
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

interface PlayerPositionValue {
  position: number;
  buffered: number;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);
const PlayerPositionContext = createContext<PlayerPositionValue | null>(null);
const TtsContext = createContext<TtsMode | null>(null);

const RATE_KEY = 'audioranobe_rate';
const VOL_KEY = 'audioranobe_volume';
const OPEN_KEY = 'audioranobe_player';

const toGain = (v: number): number => Math.pow(v, 2.5);

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
  const [ttsOn, setTtsOn] = useState(false);

  const { user } = useAuth();
  const authedRef = useRef(false);
  useEffect(() => {
    authedRef.current = !!user;
  }, [user]);

  const { toast } = useToast();
  const tts = useTtsMode({ rate, volume: toGain(volume), toast, onEnded: (ch) => ttsEndedRef.current(ch) });
  const ttsRef = useRef(tts);
  ttsRef.current = tts;

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentRef = useRef<ChapterPlay | null>(null);
  const rateRef = useRef(1);
  const volumeRef = useRef(1);
  const sleepRef = useRef<number | 'chapter' | null>(null);
  const sleepUntilRef = useRef(0);
  const endedRef = useRef<() => void>(() => {});
  const loadSeqRef = useRef(0);
  const switchingRef = useRef(false);
  const ttsOnRef = useRef(false);
  const ttsEndedRef = useRef<(ch: ChapterPlay) => void>(() => {});
  const playTtsRef = useRef<(id: number, startAt?: number) => Promise<void>>(async () => {});

  const saveProgress = useCallback((keepalive = false, positionOverride?: number) => {
    const cur = currentRef.current;
    const audio = audioRef.current;
    const tts = ttsOnRef.current;
    if (!cur || (!audio && !tts)) return;
    if (!authedRef.current) return;
    const pos = positionOverride !== undefined ? positionOverride : tts ? ttsRef.current.progress : audio!.currentTime;
    if (!Number.isFinite(pos)) return;
    try {
      fetch(`${API_URL}/me/progress/${cur.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tts ? { position: Math.max(0, pos), listened: ttsRef.current.takeListened() } : { position: Math.max(0, pos) }),
        credentials: 'include',
        keepalive,
      }).catch(() => {});
    } catch {
    }
  }, []);

  const persistOpen = useCallback(() => {
    const cur = currentRef.current;
    const audio = audioRef.current;
    if (!cur || ttsOnRef.current) return;
    const pos = audio && Number.isFinite(audio.currentTime) ? Math.round(audio.currentTime) : 0;
    try {
      document.cookie = `${OPEN_KEY}=${cur.id}:${pos};path=/;max-age=31536000;samesite=lax`;
    } catch {
    }
  }, []);

  const reportPlayError = useCallback(
      (e: unknown) => {
        if (e instanceof DOMException && (e.name === 'NotAllowedError' || e.name === 'AbortError')) return;
        toast('Не удалось воспроизвести главу', 'error');
      },
      [toast]
  );

  const ensureAudio = useCallback((): HTMLAudioElement => {
    let audio = audioRef.current;
    if (audio) return audio;
    audio = new Audio();
    audio.preload = 'auto';
    audio.playbackRate = rateRef.current;
    audio.defaultPlaybackRate = rateRef.current;
    audio.volume = toGain(volumeRef.current);

    audio.addEventListener('timeupdate', () => {
      const a = audioRef.current;
      if (!a) return;
      setPosition(a.currentTime);
      if (sleepRef.current === 'chapter' && Number.isFinite(a.duration)) {
        setSleepRemaining(Math.max(0, a.duration - a.currentTime));
      }
    });
    audio.addEventListener('loadedmetadata', () => {
      switchingRef.current = false;
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
      if (a && !a.ended && currentRef.current && !switchingRef.current) saveProgress();
    });
    audio.addEventListener('ended', () => endedRef.current());
    audio.addEventListener('error', () => {
      switchingRef.current = false;
      setPlaying(false);
      if (currentRef.current) toast('Не удалось воспроизвести главу', 'error');
    });

    audioRef.current = audio;
    return audio;
  }, [saveProgress, toast]);

  const playChapter = useCallback(
      async (id: number, startAt?: number, autoplay = true) => {
        if (ttsOnRef.current) {
          ttsRef.current.stop();
          ttsOnRef.current = false;
          setTtsOn(false);
          currentRef.current = null;
        }
        const audio = ensureAudio();
        if (currentRef.current && currentRef.current.id === id && audio.src) {
          if (startAt != null) {
            try {
              audio.currentTime = Math.max(0, startAt);
            } catch {
            }
            setPosition(Math.max(0, startAt));
          }
          if (autoplay) audio.play().catch(reportPlayError);
          return;
        }
        if (currentRef.current && currentRef.current.id !== id) saveProgress();

        const seq = ++loadSeqRef.current;
        const ch = await api<ChapterPlay>(`/chapters/${id}`);
        if (seq !== loadSeqRef.current) return;

        if (ch.narration === 'tts' || !ch.audio_url) {
          // Read aloud in the browser: the AI branch is selected or the chapter has no audio.
          if (autoplay) await playTtsRef.current(id, startAt);
          else {
            try {
              document.cookie = `${OPEN_KEY}=;path=/;max-age=0`;
            } catch {
            }
          }
          return;
        }

        currentRef.current = ch;
        setCurrent(ch);
        setBuffered(0);
        setDuration(ch.duration_seconds || 0);

        const start = startAt != null ? Math.max(0, startAt) : Math.max(0, (ch.my_position ?? 0) - 10);
        setPosition(start);

        switchingRef.current = true;
        audio.src = ch.audio_url;
        audio.playbackRate = rateRef.current;
        audio.defaultPlaybackRate = rateRef.current;
        audio.volume = toGain(volumeRef.current);
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
        if (autoplay) {
          try {
            await audio.play();
          } catch (e) {
            reportPlayError(e);
          }
        }
      },
      [ensureAudio, saveProgress, reportPlayError]
  );

  const playTts = useCallback(
      async (id: number, startAt?: number) => {
        const audio = audioRef.current;
        if (currentRef.current && currentRef.current.id !== id) saveProgress();
        if (audio && currentRef.current && !ttsOnRef.current) audio.pause();
        const seq = ++loadSeqRef.current;
        const ch = await api<ChapterPlay>(`/chapters/${id}`);
        if (seq !== loadSeqRef.current) return;
        currentRef.current = ch;
        setCurrent(ch);
        ttsOnRef.current = true;
        setTtsOn(true);
        setPosition(0);
        setDuration(0);
        setBuffered(0);
        ttsRef.current.load(ch, true, startAt);
      },
      [saveProgress]
  );

  playTtsRef.current = playTts;

  const toggle = useCallback(() => {
    if (ttsOnRef.current) {
      ttsRef.current.toggle();
      return;
    }
    const audio = audioRef.current;
    if (!audio || !currentRef.current) return;
    if (audio.paused) {
      audio.play().catch(reportPlayError);
    } else {
      audio.pause();
    }
  }, [reportPlayError]);

  const seek = useCallback(
      (s: number) => {
        if (ttsOnRef.current) {
          ttsRef.current.seekSeconds(s);
          return;
        }
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
        if (ttsOnRef.current) {
          ttsRef.current.seekSeconds(ttsRef.current.position + delta);
          return;
        }
        const audio = audioRef.current;
        if (!audio || !currentRef.current) return;
        seek(audio.currentTime + delta);
      },
      [seek]
  );

  const next = useCallback(() => {
    const cur = currentRef.current;
    if (!cur?.next_id) return;
    playChapter(cur.next_id).catch(() => {});
  }, [playChapter, playTts]);

  const prev = useCallback(() => {
    const cur = currentRef.current;
    if (!cur) return;
    if (cur.prev_id) playChapter(cur.prev_id).catch(() => {});
    else seek(0);
  }, [playChapter, playTts, seek]);

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
    if (audio) audio.volume = toGain(clamped);
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
    if (ttsOnRef.current) {
      ttsRef.current.stop();
      ttsOnRef.current = false;
      setTtsOn(false);
    }
    if (audio && currentRef.current) {
      saveProgress();
      audio.pause();
      audio.removeAttribute('src');
      try {
        audio.load();
      } catch {
      }
    }
    try {
      document.cookie = `${OPEN_KEY}=;path=/;max-age=0`;
    } catch {
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
    ttsEndedRef.current = (ch) => {
      saveProgress(false, ch.duration_seconds || ttsRef.current.progress);
      if (sleepRef.current === 'chapter') {
        sleepRef.current = null;
        setSleepState(null);
        setSleepRemaining(null);
        return;
      }
      if (ch.next_id) playChapter(ch.next_id).catch(() => {});
    };
  }, [playTts, saveProgress]);

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

  const livePlaying = ttsOn ? tts.playing : playing;
  useEffect(() => {
    if (!livePlaying) return;
    const iv = window.setInterval(() => {
      saveProgress();
      persistOpen();
    }, 10000);
    return () => window.clearInterval(iv);
  }, [livePlaying, saveProgress, persistOpen]);

  // Narration paused or stopped: keep where it got to.
  const ttsWasPlaying = useRef(false);
  useEffect(() => {
    if (ttsOn && ttsWasPlaying.current && !tts.playing) saveProgress();
    ttsWasPlaying.current = ttsOn && tts.playing;
  }, [ttsOn, tts.playing, saveProgress]);

  useEffect(() => {
    const handler = () => {
      saveProgress(true);
      persistOpen();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [saveProgress, persistOpen]);

  useEffect(() => {
    persistOpen();
  }, [current, persistOpen]);

  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    const m = document.cookie.match(/(?:^|; )audioranobe_player=([^;]+)/);
    if (!m) return;
    const [idStr, posStr] = decodeURIComponent(m[1]).split(':');
    const id = parseInt(idStr, 10);
    const pos = parseInt(posStr, 10);
    if (Number.isFinite(id) && id > 0) {
      playChapter(id, Number.isFinite(pos) ? pos : undefined, false).catch(() => {});
    }
  }, [playChapter]);

  useEffect(() => {
    if (typeof sleep !== 'number') return;
    const iv = window.setInterval(() => {
      const remaining = Math.max(0, Math.round((sleepUntilRef.current - Date.now()) / 1000));
      setSleepRemaining(remaining);
      if (remaining <= 0) {
        audioRef.current?.pause();
        ttsRef.current.pauseNow();
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
    if (!('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;
    ms.setActionHandler('play', () => toggle());
    ms.setActionHandler('pause', () => toggle());
    ms.setActionHandler('previoustrack', () => skip(-10));
    ms.setActionHandler('nexttrack', () => skip(10));
    ms.setActionHandler('seekbackward', null);
    ms.setActionHandler('seekforward', null);
    ms.setActionHandler('seekto', (e) => {
      if (e.seekTime != null) seek(e.seekTime);
    });
    return () => {
      const actions: MediaSessionAction[] = [
        'play', 'pause', 'previoustrack', 'nexttrack', 'seekbackward', 'seekforward', 'seekto',
      ];
      for (const a of actions) {
        try {
          ms.setActionHandler(a, null);
        } catch {
        }
      }
    };
  }, [toggle, skip, seek]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    if (!current) {
      navigator.mediaSession.metadata = null;
      return;
    }
    navigator.mediaSession.metadata = new MediaMetadata({
      title: chapterLabel(current.number, current.number_end, current.name),
      artist: current.title.name,
      album: current.narrator?.name || undefined,
      artwork: (() => {
        const url = current.volume.cover_url ?? current.title.cover_url;
        return url ? [{ src: url, sizes: '512x512' }] : [];
      })(),
    });
  }, [current]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.playbackState = current ? (playing ? 'playing' : 'paused') : 'none';
  }, [current, playing]);

  useEffect(() => {
    if (!('mediaSession' in navigator) || typeof navigator.mediaSession.setPositionState !== 'function') return;
    if (!current || !(duration > 0)) return;
    try {
      navigator.mediaSession.setPositionState({
        duration,
        position: Math.min(position, duration),
        playbackRate: rate,
      });
    } catch {
    }
  }, [current, duration, position, rate]);

  useEffect(() => {
    document.body.classList.toggle('has-player', !!current && !barHidden);
    return () => {
      document.body.classList.remove('has-player');
    };
  }, [current, barHidden]);

  const value = useMemo<PlayerContextValue>(
      () => ({
        current,
        playing: ttsOn ? tts.playing : playing,
        duration: ttsOn ? tts.duration : duration,
        rate,
        volume,
        sleepRemaining,
        sleep,
        playChapter,
        playTts,
        mode: ttsOn ? 'tts' : 'audio',
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
        duration,
        ttsOn,
        tts.playing,
        tts.duration,
        playTts,
        rate,
        volume,
        sleepRemaining,
        sleep,
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

  const positionValue = useMemo<PlayerPositionValue>(
      () => (ttsOn ? { position: tts.position, buffered: tts.position } : { position, buffered }),
      [position, buffered, ttsOn, tts.position]
  );

  return (
      <PlayerContext.Provider value={value}>
        <PlayerPositionContext.Provider value={positionValue}>
          <TtsContext.Provider value={tts}>{children}</TtsContext.Provider>
        </PlayerPositionContext.Provider>
      </PlayerContext.Provider>
  );
}

export function usePlayer(): PlayerContextValue {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used inside <PlayerProvider>');
  return ctx;
}

export function usePlayerPosition(): PlayerPositionValue {
  const ctx = useContext(PlayerPositionContext);
  if (!ctx) throw new Error('usePlayerPosition must be used inside <PlayerProvider>');
  return ctx;
}
export function useTts(): TtsMode {
  const ctx = useContext(TtsContext);
  if (!ctx) throw new Error('useTts must be used inside <PlayerProvider>');
  return ctx;
}
