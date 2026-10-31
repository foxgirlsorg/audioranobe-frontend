'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChapterPlay } from '@/lib/types';
import {
  deviceVoiceList,
  fetchChapterText,
  installSilero,
  listNarrationEngines,
  onNarrationProgress,
  removeSilero,
  splitParagraphs,
  type NarrationEngineId,
  type NarrationEngineInfo,
} from '@/lib/browserNarration';
import { createNarrationSession, type NarrationSession } from '@/lib/narrationSession';
import { errMsg } from '@/lib/toast';
import { chapterNumberLabel } from '@/lib/format';

export type ReaderStyle = 'focus' | 'prompter';

const DEFAULT_CPS = 14;
/** Must match ChapterText::ESTIMATE_CHARS_PER_SECOND: saved progress is measured on the same scale as the stored chapter length. */
const STORED_CPS = 14;

const ls = {
  get: (k: string): string | null => { try { return localStorage.getItem(`tts.ui.${k}`); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(`tts.ui.${k}`, v); } catch { /* private mode */ } },
};
/** "Том 2 глава 5 - Название"; the volume only when the title has several, the name only when it says more than the number. */
export function announcementLine(o: {
  volumeCount: number;
  volumeLabel: string;
  volumeNumber: number;
  number: number;
  numberEnd: number | null;
  name: string;
}): string {
  const parts: string[] = [];
  if (o.volumeCount > 1) parts.push(`${o.volumeLabel} ${chapterNumberLabel(o.volumeNumber)}`);
  parts.push(`${parts.length ? 'глава' : 'Глава'} ${chapterNumberLabel(o.number, o.numberEnd)}`);
  const name = o.name.trim();
  const bare = /^(глава|главы)?\s*[\d.,\s–-]*$/i.test(name);
  return name && !bare ? `${parts.join(' ')} - ${name}` : parts.join(' ');
}

export const chapterAnnouncement = (ch: ChapterPlay): string =>
  announcementLine({
    volumeCount: ch.volume.count ?? 1,
    volumeLabel: ch.title.volume_label,
    volumeNumber: ch.volume.number,
    number: ch.number,
    numberEnd: ch.number_end,
    name: ch.name,
  });

const num = (k: string, d: number, min: number, max: number) => {
  const raw = ls.get(k);
  const v = Number(raw);
  return raw !== null && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : d;
};

export interface TtsMode {
  chapter: ChapterPlay | null;
  paras: string[][];
  paraStart: number[];
  sentences: string[];
  idx: number;
  playing: boolean;
  busy: boolean;
  status: string | null;
  loadError: string | null;
  /** Mobile settings sheet. */
  sheet: boolean;
  setSheet(v: boolean): void;
  /** Estimated seconds (at the current speed) from the start of the chapter to the current sentence, smoothed within it. */
  position: number;
  duration: number;
  /** Progress in stored-length seconds (normal-speed scale), for saving to the server. */
  progress: number;

  style: ReaderStyle;
  setStyle(v: ReaderStyle): void;
  fontSize: number;
  setFontSize(v: number): void;
  follow: boolean;
  setFollow(v: boolean): void;
  engine: NarrationEngineId;
  setEngine(v: NarrationEngineId): void;
  speaker: string | null;
  chapterSpeaker: string;
  setSpeaker(v: string): void;
  deviceVoice: string;
  setDeviceVoice(v: string): void;
  deviceVoices: { name: string; lang: string }[];
  pause: number;
  setPause(v: number): void;
  /** Read the volume, chapter number and name before the text. */
  announce: boolean;
  setAnnounce(v: boolean): void;

  engines: NarrationEngineInfo[];
  install: { done: number; total: number } | null;
  doInstall(): Promise<boolean>;
  cancelInstall(): void;
  doRemove(): Promise<void>;

  /** `startAt`: a saved/shared text point (stored-length scale); defaults to the user's saved progress. */
  load(ch: ChapterPlay, autoplay: boolean, startAt?: number): void;
  /** Seconds of narration listened to since the last call, counted at normal speed like audio (9 s at 3x = 27), for stats. */
  takeListened(): number;
  toggle(): void;
  pauseNow(): void;
  seekSentence(i: number, debounce?: boolean): void;
  seekSeconds(s: number): void;
  stop(): void;
}

export function useTtsMode({
  rate,
  volume,
  toast,
  onEnded,
}: {
  rate: number;
  volume: number;
  toast: (msg: string, kind?: 'ok' | 'error') => void;
  onEnded: (chapter: ChapterPlay) => void;
}): TtsMode {
  const [chapter, setChapter] = useState<ChapterPlay | null>(null);
  const [paras, setParas] = useState<string[][]>([]);
  const [chapterSpeaker, setChapterSpeaker] = useState('baya');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [smooth, setSmooth] = useState(0);
  const [sheet, setSheet] = useState(false);
  const [finished, setFinished] = useState(false);

  const [style, setStyleState] = useState<ReaderStyle>('focus');
  const [fontSize, setFontSizeState] = useState(26);
  const [follow, setFollowState] = useState(true);
  const [engine, setEngineState] = useState<NarrationEngineId>('silero');
  const [speaker, setSpeakerState] = useState<string | null>(null);
  const [deviceVoice, setDeviceVoiceState] = useState('');
  const [pause, setPauseState] = useState(0.35);
  const [announce, setAnnounceState] = useState(true);
  const [annLen, setAnnLen] = useState(0);
  useEffect(() => {
    setStyleState(ls.get('style') === 'prompter' ? 'prompter' : 'focus');
    setFontSizeState(num('fs', 26, 16, 40));
    setFollowState(ls.get('follow') !== '0');
    setEngineState(ls.get('engine') === 'device' ? 'device' : 'silero');
    setSpeakerState(ls.get('speaker'));
    setDeviceVoiceState(ls.get('deviceVoice') ?? '');
    setPauseState(num('pause', 0.35, 0.1, 0.9));
    setAnnounceState(ls.get('announce') !== '0');
  }, []);

  const [engines, setEngines] = useState<NarrationEngineInfo[]>([]);
  const [deviceVoices, setDeviceVoices] = useState<{ name: string; lang: string }[]>([]);
  const [install, setInstall] = useState<{ done: number; total: number } | null>(null);
  const installAbort = useRef<AbortController | null>(null);
  const [measured, setMeasured] = useState({ chars: 0, secs: 0 });

  const sessRef = useRef<NarrationSession | null>(null);
  const volumeRef = useRef(volume);
  volumeRef.current = volume;
  const idxRef = useRef(0);
  const playingRef = useRef(false);
  const idxAt = useRef(0);
  const autoplayRef = useRef(false);
  const seekTimer = useRef<number | null>(null);
  const chapterRef = useRef<ChapterPlay | null>(null);
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;
  const loadSeq = useRef(0);
  const resumeRef = useRef(0);
  const listenedRef = useRef(0);
  const busyRef = useRef(false);
  busyRef.current = busy;
  const announceRef = useRef(announce);
  announceRef.current = announce;
  const rateRef = useRef(rate);
  rateRef.current = rate;

  const sentences = useMemo(() => paras.flat(), [paras]);
  const paraStart = useMemo(() => {
    const out: number[] = [];
    let n = 0;
    for (const p of paras) { out.push(n); n += p.length; }
    return out;
  }, [paras]);
  const activeSpeaker = speaker ?? chapterSpeaker;
  const silero = engines.find((e) => e.id === 'silero');

  const cps = measured.secs > 5 ? measured.chars / measured.secs : DEFAULT_CPS;
  const starts = useMemo(() => {
    const out: number[] = [];
    let c = 0;
    for (const t of sentences) { out.push(c / (cps * rate)); c += t.length; }
    out.push(c / (cps * rate));
    return out;
  }, [sentences, cps, rate]);
  const duration = starts[starts.length - 1] ?? 0;
  const progress = useMemo(() => {
    let chars = 0;
    const upTo = finished ? sentences.length : idx;
    for (let i = annLen; i < upTo; i++) chars += sentences[i].length + 1;
    return chars / STORED_CPS;
  }, [sentences, idx, finished, annLen]);
  const sentenceLen = (starts[idx + 1] ?? duration) - (starts[idx] ?? 0);
  const position = finished ? duration : Math.min(duration, (starts[idx] ?? 0) + Math.min(smooth, sentenceLen));

  // Without a Russian built-in voice Silero is the only option, whatever was saved.
  useEffect(() => {
    const device = engines.find((e) => e.id === 'device');
    if (device && !device.available && engine === 'device') setEngineState('silero');
  }, [engines, engine]);

  const stopSession = useCallback(() => {
    sessRef.current?.stop();
    sessRef.current = null;
    playingRef.current = false;
    setPlaying(false);
    setBusy(false);
  }, []);
  useEffect(() => () => { sessRef.current?.stop(); sessRef.current = null; }, []);

  const refreshEngines = useCallback(async () => { setEngines(await listNarrationEngines()); }, []);
  useEffect(() => {
    if (!chapter) return;
    void refreshEngines();
    void deviceVoiceList().then((v) => {
      setDeviceVoices(v);
      setDeviceVoiceState((cur) => cur || v[0]?.name || '');
    });
    onNarrationProgress((m) => setStatus(m === 'python' ? 'Запуск озвучки…' : null));
  }, [chapter, refreshEngines]);

  const load = useCallback((ch: ChapterPlay, autoplay: boolean, startAt?: number) => {
    const seq = ++loadSeq.current;
    stopSession();
    chapterRef.current = ch;
    setChapter(ch);
    setParas([]);
    setIdx(0);
    idxRef.current = 0;
    setSmooth(0);
    setFinished(false);
    setLoadError(null);
    autoplayRef.current = autoplay;
    resumeRef.current = startAt !== undefined && startAt > 0
      ? startAt
      : ch.my_position && ch.duration_seconds && ch.my_position < ch.duration_seconds - 5 ? ch.my_position : 0;
    fetchChapterText(ch.id)
      .then((t) => {
        if (seq !== loadSeq.current) return;
        setChapterSpeaker(t.speaker || 'baya');
        const body = splitParagraphs(t.text);
        const line = announceRef.current ? chapterAnnouncement(ch) : '';
        setAnnLen(line ? 1 : 0);
        setParas(line ? [[line], ...body] : body);
      })
      .catch((e) => { if (seq === loadSeq.current) setLoadError(errMsg(e)); });
  }, [stopSession]);

  const stop = useCallback(() => {
    loadSeq.current++;
    stopSession();
    chapterRef.current = null;
    setChapter(null);
    setParas([]);
    setIdx(0);
    idxRef.current = 0;
  }, [stopSession]);

  const build = useCallback(
    (): NarrationSession =>
      createNarrationSession({
        engine,
        sentences,
        speaker: activeSpeaker,
        deviceVoice,
        rate,
        pause,
        volume: volumeRef.current,
        onIndex: (i) => { idxRef.current = i; idxAt.current = performance.now(); setSmooth(0); setIdx(i); },
        onBusy: setBusy,
        onMeasure: (chars, secs) => setMeasured((m) => ({ chars: m.chars + chars, secs: m.secs + secs })),
        onError: (m) => { toast(m, 'error'); stopSession(); },
        onEnd: () => {
          playingRef.current = false;
          setPlaying(false);
          setFinished(true);
          sessRef.current = null;
          if (chapterRef.current) onEndedRef.current(chapterRef.current);
        },
      }),
    [engine, sentences, activeSpeaker, deviceVoice, rate, pause, toast, stopSession],
  );

  /** Downloads the Silero model into the browser; true when it is installed afterwards. */
  const doInstall = useCallback(async (): Promise<boolean> => {
    if (installAbort.current) return false;
    const ac = new AbortController();
    installAbort.current = ac;
    const before = (await listNarrationEngines()).find((e) => e.id === 'silero');
    setInstall({ done: 0, total: before?.downloadBytes ?? 1 });
    try {
      await installSilero((p) => setInstall(p), ac.signal);
    } catch (e) {
      if (!ac.signal.aborted) toast(errMsg(e), 'error');
    }
    installAbort.current = null;
    setInstall(null);
    const after = (await listNarrationEngines()).find((e) => e.id === 'silero');
    setEngines(await listNarrationEngines());
    return !!after?.installed;
  }, [toast]);

  const play = useCallback((from: number) => {
    if (!sentences.length) return;
    sessRef.current?.stop();
    sessRef.current = null;
    playingRef.current = true;
    setPlaying(true);
    setBusy(true);
    setFinished(false);
    idxRef.current = from;
    idxAt.current = performance.now();
    setIdx(from);
    setSmooth(0);
    const run = () => {
      const s = build();
      sessRef.current = s;
      s.start(from);
    };
    if (engine !== 'silero') {
      run();
      return;
    }
    // Silero needs its model in the browser: fetch it on the first play, then start.
    void (async () => {
      const info = (await listNarrationEngines()).find((e) => e.id === 'silero');
      if (!info?.installed) {
        if (!info?.available) {
          toast('Модель Silero сейчас недоступна', 'error');
          stopSession();
          return;
        }
        if (!(await doInstall())) {
          stopSession();
          return;
        }
      }
      if (playingRef.current && !sessRef.current) run();
    })();
  }, [sentences.length, engine, build, toast, doInstall, stopSession]);
  const playRef = useRef(play);
  playRef.current = play;

  useEffect(() => {
    if (!sentences.length) return;
    let start = 0;
    if (resumeRef.current > 0) {
      let chars = 0;
      for (let i = annLen; i < sentences.length && chars / STORED_CPS < resumeRef.current; i++) {
        start = i;
        chars += sentences[i].length + 1;
      }
      resumeRef.current = 0;
      if (start > 0) {
        idxRef.current = start;
        setIdx(start);
      }
    }
    if (autoplayRef.current) {
      autoplayRef.current = false;
      play(start);
    }
  }, [sentences, play, annLen]);

  const pauseNow = useCallback(() => {
    if (!playingRef.current) return;
    sessRef.current?.pause();
    playingRef.current = false;
    setPlaying(false);
  }, []);

  const toggle = useCallback(() => {
    if (playingRef.current) pauseNow();
    else if (sessRef.current) {
      sessRef.current.resume();
      idxAt.current = performance.now() - smooth * 1000;
      playingRef.current = true;
      setPlaying(true);
    } else play(idxRef.current);
  }, [pauseNow, play, smooth]);

  const seekSentence = useCallback((i: number, debounce = false) => {
    const k = Math.min(Math.max(0, i), Math.max(0, sentences.length - 1));
    idxRef.current = k;
    setIdx(k);
    setSmooth(0);
    setFinished(false);
    if (!sessRef.current) return;
    if (seekTimer.current) window.clearTimeout(seekTimer.current);
    const go = () => { if (playingRef.current) playRef.current(k); else stopSession(); };
    if (debounce) seekTimer.current = window.setTimeout(go, 250);
    else go();
  }, [sentences.length, stopSession]);

  const seekSeconds = useCallback((s: number) => {
    let k = 0;
    while (k < sentences.length - 1 && starts[k + 1] <= s) k++;
    seekSentence(k, true);
  }, [sentences.length, starts, seekSentence]);

  // Settings the running session captured when it was created: restart it from the current sentence.
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    if (!sessRef.current) return;
    const t = window.setTimeout(() => {
      if (!sessRef.current) return;
      const was = playingRef.current;
      const at = idxRef.current;
      stopSession();
      if (was) playRef.current(at);
    }, 350);
    return () => window.clearTimeout(t);
  }, [engine, activeSpeaker, deviceVoice, rate, stopSession]);
  useEffect(() => { sessRef.current?.setPause(pause); }, [pause]);
  useEffect(() => { sessRef.current?.setVolume(volume); }, [volume]);

  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    const iv = window.setInterval(() => {
      const now = performance.now();
      if (busyRef.current) idxAt.current = now;
      else listenedRef.current += ((now - last) / 1000) * rateRef.current;
      last = now;
      setSmooth((now - idxAt.current) / 1000);
    }, 250);
    return () => window.clearInterval(iv);
  }, [playing]);

  const doRemove = useCallback(async () => {
    stopSession();
    await removeSilero();
    await refreshEngines();
  }, [stopSession, refreshEngines]);

  return {
    chapter, paras, paraStart, sentences, idx, playing, busy, status, loadError, position, duration, progress, sheet, setSheet,
    style, setStyle: (v) => { setStyleState(v); ls.set('style', v); },
    fontSize, setFontSize: (v) => { setFontSizeState(v); ls.set('fs', String(v)); },
    follow, setFollow: (v) => { setFollowState(v); ls.set('follow', v ? '1' : '0'); },
    engine, setEngine: (v) => { setEngineState(v); ls.set('engine', v); },
    speaker, chapterSpeaker, setSpeaker: (v) => { setSpeakerState(v); ls.set('speaker', v); },
    deviceVoice, setDeviceVoice: (v) => { setDeviceVoiceState(v); ls.set('deviceVoice', v); },
    deviceVoices,
    pause, setPause: (v) => { setPauseState(v); ls.set('pause', String(v)); },
    announce, setAnnounce: (v) => { setAnnounceState(v); ls.set('announce', v ? '1' : '0'); },
    engines, install, doInstall, cancelInstall: () => installAbort.current?.abort(), doRemove,
    load, takeListened: () => { const v = listenedRef.current; listenedRef.current = 0; return v; }, toggle, pauseNow, seekSentence, seekSeconds, stop,
  };
}
