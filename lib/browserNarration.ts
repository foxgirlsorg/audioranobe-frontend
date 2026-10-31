import { api, API_URL } from '@/lib/api';

/**
 * Listener-side narration of a chapter's stored text. Two engines:
 *  - 'silero': Silero v5.5 RU (ONNX + Pyodide) in a Web Worker. The ~130 MB of model files live on our server
 *    (GET /tts/manifest, /tts/model/{name}) and are fetched into the browser's IndexedDB only when the
 *    listener installs the engine; nothing is uploaded back.
 *  - 'device': the browser/OS built-in speech synthesis (Web Speech API).
 * The runtime (onnxruntime-web, Pyodide) is static under /tts/vendor (override base with NEXT_PUBLIC_TTS_BASE).
 */
const BASE = (process.env.NEXT_PUBLIC_TTS_BASE || '/tts').replace(/\/$/, '');
const MODEL_BASE = `${API_URL}/tts/model/`;
const LS_VERSION = 'tts.silero.version';
const LS_ENGINE = 'tts.engine';
export const NARRATION_SAMPLE_RATE = 48000;

export type NarrationEngineId = 'silero' | 'device';

export interface NarrationEngineInfo {
  id: NarrationEngineId;
  label: string;
  /** Silero: model files are in this browser. Device: always true when available. */
  installed: boolean;
  /** Can be used / installed right now. */
  available: boolean;
  /** Silero: bytes to download to install (or update). */
  downloadBytes?: number;
  /** Silero: a newer model set is on the server than the installed one. */
  updateAvailable?: boolean;
  /** Device: the Russian voice that would be used. */
  voice?: string;
}

interface Manifest { version: string; total: number; files: { name: string; size: number }[] }

const ls = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string | null) => { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* private mode */ } },
};

// ── Silero model install (server → IndexedDB) ───────────────────────────────
// IndexedDB rather than Cache Storage: the latter does not exist on plain-http origins (LAN hosts), IndexedDB does.

// Plain fetch: public data, no session needed (and no credentialed-CORS coupling).
async function fetchManifest(): Promise<Manifest> {
  const res = await fetch(`${API_URL}/tts/manifest`);
  if (!res.ok) throw new Error(`manifest: HTTP ${res.status}`);
  return res.json();
}
const installedVersion = (): string | null => ls.get(LS_VERSION);

const DB_NAME = 'tts-models';
const STORE = 'files';
const DONE = '.done';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('Браузер не поддерживает локальное хранилище моделей'));
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error ?? new Error('IndexedDB недоступна'));
  });
}
const idbDo = <T,>(db: IDBDatabase, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

async function cacheComplete(version: string): Promise<boolean> {
  try {
    const db = await openDb();
    const ok = (await idbDo(db, 'readonly', (s) => s.get(`${version}/${DONE}`))) !== undefined;
    db.close();
    return ok;
  } catch {
    return false;
  }
}

async function deleteVersions(db: IDBDatabase, keep?: string): Promise<void> {
  const keys = (await idbDo(db, 'readonly', (s) => s.getAllKeys())) as string[];
  for (const k of keys) if (!keep || !k.startsWith(`${keep}/`)) await idbDo(db, 'readwrite', (s) => s.delete(k));
}

export interface InstallProgress { done: number; total: number }

/** Download the Silero model set from our server into this browser. Resumes nothing: an aborted install leaves no half-set behind. */
export async function installSilero(onProgress?: (p: InstallProgress) => void, signal?: AbortSignal): Promise<void> {
  const db = await openDb();
  try {
    const m = await fetchManifest();
    let done = 0;
    for (const f of m.files) {
      const res = await fetch(`${MODEL_BASE}${f.name}?v=${m.version}`, { signal });
      if (!res.ok || !res.body) throw new Error(`${f.name}: HTTP ${res.status}`);
      const reader = res.body.getReader();
      const parts: Uint8Array[] = [];
      for (;;) {
        const { done: end, value } = await reader.read();
        if (end) break;
        parts.push(value);
        done += value.length;
        onProgress?.({ done, total: m.total });
      }
      await idbDo(db, 'readwrite', (s) => s.put(new Blob(parts as BlobPart[]), `${m.version}/${f.name}`));
    }
    await idbDo(db, 'readwrite', (s) => s.put(true, `${m.version}/${DONE}`));
    // Drop older model sets only after the new one is complete.
    await deleteVersions(db, m.version);
    ls.set(LS_VERSION, m.version);
  } catch (e) {
    await deleteVersions(db).catch(() => {});
    throw e;
  } finally {
    db.close();
  }
  try { await navigator.storage?.persist?.(); } catch { /* best effort */ }
  narrator.reset();
}

/** Delete the Silero model files from this browser. */
export async function removeSilero(): Promise<void> {
  narrator.reset();
  ls.set(LS_VERSION, null);
  try {
    const db = await openDb();
    await deleteVersions(db);
    db.close();
  } catch { /* nothing stored */ }
}

// ── Device (Web Speech API) ─────────────────────────────────────────────────

const deviceSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';

function deviceVoices(): Promise<SpeechSynthesisVoice[]> {
  const synth = window.speechSynthesis;
  const now = synth.getVoices();
  if (now.length) return Promise.resolve(now);
  return new Promise((resolve) => {
    const done = () => { synth.removeEventListener('voiceschanged', done); resolve(synth.getVoices()); };
    synth.addEventListener('voiceschanged', done);
    setTimeout(done, 1500); // some browsers never fire the event
  });
}

export async function russianVoice(name?: string): Promise<SpeechSynthesisVoice | null> {
  if (!deviceSupported()) return null;
  const vs = await deviceVoices();
  const picked = name ? vs.find((v) => v.name === name) : undefined;
  if (picked) return picked;
  return vs.find((v) => v.lang.toLowerCase().startsWith('ru') && v.localService) ?? vs.find((v) => v.lang.toLowerCase().startsWith('ru')) ?? null;
}

/** Sentences packed to <= 200 chars: long utterances get cut off by some engines (Chrome stops after ~15 s). */
function speechPieces(text: string): string[] {
  const out: string[] = [];
  let buf = '';
  for (const s of text.replace(/\s+/g, ' ').trim().split(/(?<=[.!?…])\s+/)) {
    if (buf && buf.length + s.length + 1 > 200) { out.push(buf); buf = ''; }
    buf = buf ? `${buf} ${s}` : s;
    while (buf.length > 200) { const cut = buf.lastIndexOf(' ', 200); const at = cut > 50 ? cut : 200; out.push(buf.slice(0, at)); buf = buf.slice(at).trim(); }
  }
  if (buf) out.push(buf);
  return out;
}

// ── Engine list / preference ────────────────────────────────────────────────

/** The narration engines this browser can offer, for a picker. Silero reports server reachability and install state. */
export async function listNarrationEngines(): Promise<NarrationEngineInfo[]> {
  const out: NarrationEngineInfo[] = [];
  const ver = installedVersion();
  const installed = ver !== null && (await cacheComplete(ver));
  let manifest: Manifest | null = null;
  try { manifest = await fetchManifest(); } catch { /* server has no models, or offline */ }
  out.push({
    id: 'silero',
    label: 'Silero (качество как у озвучки сайта)',
    installed,
    available: installed || manifest !== null,
    downloadBytes: manifest && (!installed || manifest.version !== ver) ? manifest.total : undefined,
    updateAvailable: installed && manifest !== null && manifest.version !== ver,
  });
  const voice = await russianVoice();
  out.push({
    id: 'device',
    label: 'Голос устройства',
    installed: deviceSupported(),
    available: voice !== null,
    voice: voice?.name,
  });
  return out;
}

export const getNarrationEngine = (): NarrationEngineId => (ls.get(LS_ENGINE) === 'device' ? 'device' : 'silero');
export const setNarrationEngine = (id: NarrationEngineId) => ls.set(LS_ENGINE, id);

// ── Silero worker ───────────────────────────────────────────────────────────

interface Pending {
  onChunk: (audio: Float32Array) => void;
  resolve: () => void;
  reject: (e: Error) => void;
}

class Narrator {
  private worker: Worker | null = null;
  private ready: Promise<void> | null = null;
  private pending = new Map<number, Pending>();
  private nextId = 1;
  onProgress?: (msg: string) => void;

  /** Forget the loaded model (after install/remove). */
  reset() {
    this.worker?.terminate();
    this.worker = null;
    this.ready = null;
    for (const p of this.pending.values()) p.reject(new Error('Озвучка остановлена'));
    this.pending.clear();
  }

  private start(): Promise<void> {
    if (this.ready) return this.ready;
    const ver = installedVersion();
    if (!ver) return Promise.reject(new Error('Модель Silero не установлена'));
    const worker = new Worker(`${BASE}/worker.js`);
    this.worker = worker;
    this.ready = new Promise<void>((resolve, reject) => {
      worker.onmessage = (e: MessageEvent) => {
        const m = e.data;
        if (m.type === 'ready') resolve();
        else if (m.type === 'progress') this.onProgress?.(m.msg);
        else if (m.type === 'chunk') this.pending.get(m.id)?.onChunk(m.audio);
        else if (m.type === 'done') { this.pending.get(m.id)?.resolve(); this.pending.delete(m.id); }
        else if (m.type === 'error') {
          const err = new Error(m.message);
          const p = m.id != null ? this.pending.get(m.id) : undefined;
          if (p) { p.reject(err); this.pending.delete(m.id); } else reject(err);
        }
      };
      worker.onerror = (e) => reject(new Error(e.message || 'worker failed'));
      worker.postMessage({ type: 'init', vendor: `${BASE}/vendor/`, cache: ver, base: MODEL_BASE });
    });
    this.ready.catch(() => { if (this.worker === worker) { worker.terminate(); this.worker = null; this.ready = null; } });
    return this.ready;
  }

  async narrate(text: string, speaker: string, onChunk: (audio: Float32Array) => void, signal?: AbortSignal, pause?: number): Promise<void> {
    await this.start();
    const id = this.nextId++;
    const done = new Promise<void>((resolve, reject) => this.pending.set(id, { onChunk, resolve, reject }));
    signal?.addEventListener('abort', () => this.worker?.postMessage({ type: 'cancel', id }), { once: true });
    this.worker!.postMessage({ type: 'narrate', id, text, speaker, pause });
    return done;
  }
}

const narrator = new Narrator();

export function onNarrationProgress(fn: (msg: string) => void) { narrator.onProgress = fn; }

// ── Chapter text ────────────────────────────────────────────────────────────

export interface ChapterText {
  chapter_id: number;
  text: string;
  edited: boolean;
  speaker: string;
  sample_rate: number;
  defaults?: { pause: number; announce: boolean; engine: NarrationEngineId };
}

export const fetchChapterText = (chapterId: number) => api<ChapterText>(`/chapters/${chapterId}/text`);

/** Hand-edit a chapter's text (needs the narration.books permission). */
export const saveChapterText = (chapterId: number, text: string) =>
  api(`/chapters/${chapterId}/text`, { method: 'PUT', body: { text } });

// ── Playback ────────────────────────────────────────────────────────────────

export interface NarrationPlayback {
  /** Resolves when synthesis has finished and the last sample has played (or after stop()). */
  finished: Promise<void>;
  stop: () => void;
  /** Seconds played so far. */
  position: () => number;
}

function playSilero(text: string, speaker: string): NarrationPlayback {
  const ctx = new AudioContext({ sampleRate: NARRATION_SAMPLE_RATE });
  const abort = new AbortController();
  const sources: AudioBufferSourceNode[] = [];
  let stopped = false;
  let playAt = 0;
  const started = ctx.currentTime;

  const finished = (async () => {
    await ctx.resume();
    playAt = ctx.currentTime + 0.1;
    await narrator.narrate(text, speaker, (audio) => {
      if (stopped) return;
      const buf = ctx.createBuffer(1, audio.length, NARRATION_SAMPLE_RATE);
      buf.getChannelData(0).set(audio);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      playAt = Math.max(playAt, ctx.currentTime);
      src.start(playAt);
      playAt += buf.duration;
      sources.push(src);
    }, abort.signal);
    if (!stopped) {
      await new Promise<void>((resolve) => {
        const last = sources[sources.length - 1];
        if (!last) return resolve();
        last.onended = () => resolve();
      });
    }
  })().finally(() => { void ctx.close(); });

  return {
    finished,
    stop() {
      stopped = true;
      abort.abort();
      for (const s of sources) { try { s.stop(); } catch { /* not started */ } }
    },
    position: () => Math.max(0, ctx.currentTime - started),
  };
}

function playDevice(text: string): NarrationPlayback {
  const synth = window.speechSynthesis;
  const t0 = performance.now();
  let stopped = false;
  const finished = (async () => {
    const voice = await russianVoice();
    if (!voice) throw new Error('На устройстве нет русского голоса');
    synth.cancel();
    const pieces = speechPieces(text);
    await new Promise<void>((resolve, reject) => {
      pieces.forEach((piece, i) => {
        const u = new SpeechSynthesisUtterance(piece);
        u.voice = voice;
        u.lang = voice.lang;
        u.onerror = (e) => { if (!stopped && e.error !== 'canceled' && e.error !== 'interrupted') reject(new Error(e.error)); else resolve(); };
        if (i === pieces.length - 1) u.onend = () => resolve();
        synth.speak(u);
      });
      if (!pieces.length) resolve();
    });
  })();
  return {
    finished,
    stop() { stopped = true; synth.cancel(); },
    position: () => (performance.now() - t0) / 1000,
  };
}

/**
 * Narrate a chapter from its stored text and play it as it is produced.
 * `engine` defaults to the saved preference; Silero must have been installed first (installSilero).
 * Failures (no text, model missing, no voice) reject `finished`.
 */
export function playChapter(chapterId: number, engine: NarrationEngineId = getNarrationEngine()): NarrationPlayback {
  let inner: NarrationPlayback | null = null;
  let stopped = false;
  const finished = (async () => {
    const { text, speaker } = await fetchChapterText(chapterId);
    if (stopped) return;
    inner = engine === 'device' ? playDevice(text) : playSilero(text, speaker);
    await inner.finished;
  })();
  return {
    finished,
    stop() { stopped = true; inner?.stop(); },
    position: () => inner?.position() ?? 0,
  };
}

// ── Sentence-level API for the full-screen player ────────────────────────────

export const SILERO_SPEAKERS: { id: string; label: string; hint: string }[] = [
  { id: 'baya', label: 'Байя', hint: 'baya · женский' },
  { id: 'kseniya', label: 'Ксения', hint: 'kseniya · женский' },
  { id: 'xenia', label: 'Ксения 2', hint: 'xenia · женский' },
  { id: 'aidar', label: 'Айдар', hint: 'aidar · мужской' },
  { id: 'eugene', label: 'Евгений', hint: 'eugene · мужской' },
];

/** Synthesize one piece of text with Silero; onChunk gets 48 kHz mono audio (plus `pause` seconds of silence after each piece). */
export const narrateText = (text: string, speaker: string, onChunk: (audio: Float32Array) => void, signal?: AbortSignal, pause?: number) =>
  narrator.narrate(text, speaker, onChunk, signal, pause);

export async function deviceVoiceList(): Promise<{ name: string; lang: string }[]> {
  if (!deviceSupported()) return [];
  return (await deviceVoices()).filter((v) => v.lang.toLowerCase().startsWith('ru')).map((v) => ({ name: v.name, lang: v.lang }));
}

/** Chapter text as paragraphs of sentences. */
export function splitParagraphs(text: string): string[][] {
  return text
    .split(/\n+/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .map((p) => p.split(/(?<=[.!?…])\s+(?!—\s*[а-яё])/).flatMap(breakLong).filter(Boolean));
}

const MAX_SENTENCE = 300;

function breakLong(s: string): string[] {
  const out: string[] = [];
  while (s.length > MAX_SENTENCE) {
    const cut = Math.max(s.lastIndexOf(' ', MAX_SENTENCE), s.lastIndexOf(', ', MAX_SENTENCE) + 1);
    const at = cut > MAX_SENTENCE / 3 ? cut : MAX_SENTENCE;
    out.push(s.slice(0, at).trim());
    s = s.slice(at).trim();
  }
  out.push(s);
  return out;
}
