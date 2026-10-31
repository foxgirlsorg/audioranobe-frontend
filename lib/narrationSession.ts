import { timeStretch } from '@/lib/timeStretch';
import { NARRATION_SAMPLE_RATE, narrateText, russianVoice, type NarrationEngineId } from '@/lib/browserNarration';

/** Sentence-by-sentence narration of a chapter, reporting which sentence is being spoken. */
export interface NarrationSession {
  /** Start (or restart) speaking from sentence `from`. Must be called from a user gesture the first time. */
  start(from: number): void;
  pause(): void;
  resume(): void;
  stop(): void;
  setRate(rate: number): void;
  setPause(seconds: number): void;
  setVolume(gain: number): void;
}

export interface SessionOptions {
  engine: NarrationEngineId;
  sentences: string[];
  speaker: string;
  deviceVoice?: string;
  rate: number;
  pause: number;
  volume: number;
  onIndex(i: number): void;
  onEnd(): void;
  onError(message: string): void;
  /** True while the next sentence is still being synthesized and nothing is audible. */
  onBusy(busy: boolean): void;
  /** A sentence of `chars` characters came out of the synthesizer as `secs` seconds of audio at normal speed. */
  onMeasure?(chars: number, secs: number): void;
}

const LOOKAHEAD_SECONDS = 25;
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

function sileroSession(o: SessionOptions): NarrationSession {
  let ctx: AudioContext | null = null;
  let out: GainNode | null = null;
  let gen = 0;
  let rate = o.rate;
  let pause = o.pause;
  let volume = o.volume;
  let sources: AudioBufferSourceNode[] = [];
  let scheduled: { idx: number; at: number }[] = [];
  let abort: AbortController | null = null;
  let timer = 0;
  let cur = -1;
  let doneAt = -1;

  const halt = () => {
    gen++;
    abort?.abort();
    for (const s of sources) { try { s.stop(); } catch { /* not started */ } }
    sources = [];
    scheduled = [];
    window.clearInterval(timer);
    doneAt = -1;
  };

  async function produce(from: number, g: number) {
    const c = ctx!;
    abort = new AbortController();
    let playAt = c.currentTime + 0.15;
    for (let i = from; i < o.sentences.length && g === gen; i++) {
      while (g === gen && playAt - c.currentTime > LOOKAHEAD_SECONDS) await wait(250);
      if (g !== gen) return;
      if (playAt - c.currentTime < 0.2) o.onBusy(true);
      const parts: Float32Array[] = [];
      try {
        await narrateText(o.sentences[i], o.speaker, (a) => parts.push(a), abort.signal, pause);
      } catch (e) {
        if (g === gen) { o.onBusy(false); o.onError(errText(e)); }
        return;
      }
      if (g !== gen) return;
      const length = parts.reduce((n, a) => n + a.length, 0);
      if (!length) continue;
      const joined = new Float32Array(length);
      let at = 0;
      for (const a of parts) { joined.set(a, at); at += a.length; }
      o.onMeasure?.(o.sentences[i].length, length / NARRATION_SAMPLE_RATE);
      const audio = timeStretch(joined, rate);
      const buf = c.createBuffer(1, audio.length, NARRATION_SAMPLE_RATE);
      buf.getChannelData(0).set(audio);
      const src = c.createBufferSource();
      src.buffer = buf;
      src.connect(out ?? c.destination);
      const startAt = Math.max(playAt, c.currentTime + 0.02);
      src.start(startAt);
      sources.push(src);
      scheduled.push({ idx: i, at: startAt });
      playAt = startAt + buf.duration;
    }
    if (g === gen) doneAt = playAt;
  }

  function poll(g: number) {
    timer = window.setInterval(() => {
      if (g !== gen || !ctx) return;
      const t = ctx.currentTime;
      let idx = -1;
      for (const s of scheduled) if (s.at <= t) idx = s.idx;
      if (idx >= 0) {
        o.onBusy(false);
        if (idx !== cur) { cur = idx; o.onIndex(idx); }
        scheduled = scheduled.filter((s) => s.idx >= idx);
      }
      if (doneAt >= 0 && t >= doneAt) { halt(); o.onEnd(); }
    }, 100);
  }

  return {
    start(from) {
      halt();
      if (!ctx) {
        ctx = new AudioContext({ sampleRate: NARRATION_SAMPLE_RATE });
        out = ctx.createGain();
        out.gain.value = volume;
        out.connect(ctx.destination);
      }
      cur = -1;
      const g = gen;
      void ctx.resume();
      void produce(from, g);
      poll(g);
    },
    pause() { void ctx?.suspend(); },
    resume() { void ctx?.resume(); },
    stop() {
      halt();
      o.onBusy(false);
      const c = ctx;
      ctx = null;
      out = null;
      if (c) void c.close();
    },
    setRate(r) { rate = r; },
    setPause(p) { pause = p; },
    setVolume(v) { volume = v; if (out) out.gain.value = v; },
  };
}

function deviceSession(o: SessionOptions): NarrationSession {
  const synth = window.speechSynthesis;
  let gen = 0;
  let rate = o.rate;
  let pause = o.pause;
  let volume = o.volume;

  return {
    start(from) {
      synth.cancel();
      const g = ++gen;
      void (async () => {
        const voice = await russianVoice(o.deviceVoice);
        if (g !== gen) return;
        if (!voice) { o.onError('На устройстве нет русского голоса'); return; }
        const speak = (k: number) => {
          if (g !== gen) return;
          if (k >= o.sentences.length) { o.onEnd(); return; }
          const u = new SpeechSynthesisUtterance(o.sentences[k]);
          u.voice = voice;
          u.lang = voice.lang;
          u.rate = rate;
          u.volume = volume;
          u.onstart = () => { if (g === gen) o.onIndex(k); };
          u.onend = () => { if (g === gen) window.setTimeout(() => speak(k + 1), pause * 1000); };
          u.onerror = (e) => { if (g === gen && e.error !== 'canceled' && e.error !== 'interrupted') o.onError(e.error); };
          synth.speak(u);
        };
        speak(from);
      })();
    },
    pause() { synth.pause(); },
    resume() { synth.resume(); },
    stop() { gen++; synth.cancel(); },
    setRate(r) { rate = r; },
    setPause(p) { pause = p; },
    setVolume(v) { volume = v; },
  };
}

export const createNarrationSession = (o: SessionOptions): NarrationSession =>
  o.engine === 'device' ? deviceSession(o) : sileroSession(o);
