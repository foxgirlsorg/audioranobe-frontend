/* Web Worker hosting the in-browser Silero narrator. Protocol (see lib/browserNarration.ts):
 *   -> {type:'init', vendor, cache (model version), base}                -> {type:'progress', msg} ... {type:'ready'} | {type:'error', message}
 *   -> {type:'narrate', id, text, speaker, pause?}         -> {type:'chunk', id, audio:Float32Array} ... {type:'done', id} | {type:'error', id, message}
 *   -> {type:'cancel', id}
 */
'use strict';

let engine = null;
const aborts = new Map();
let queue = Promise.resolve();

const post = (msg, transfer) => self.postMessage(msg, transfer || []);

async function init({ vendor, cache, base }) {
  importScripts(vendor + 'ort/ort.wasm.min.js', vendor + 'pyodide/pyodide.js', new URL('engine.js', self.location.href).href);
  ort.env.wasm.wasmPaths = vendor + 'ort/';
  ort.env.wasm.numThreads = self.crossOriginIsolated ? Math.min(4, self.navigator.hardwareConcurrency || 1) : 1;

  self.unicode_category = (ch) => {
    if (/\p{C}/u.test(ch)) return 'Cc';
    if (/\p{Zs}/u.test(ch)) return 'Zs';
    if (/\p{P}/u.test(ch)) return 'Po';
    return 'Lo';
  };
  // Model files come only from the IndexedDB the listener filled by installing the model; never from the network.
  const db = await new Promise((resolve, reject) => {
    const r = indexedDB.open('tts-models', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('files');
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  const get = async (name) => {
    const blob = await new Promise((resolve, reject) => {
      const q = db.transaction('files').objectStore('files').get(cache + '/' + name);
      q.onsuccess = () => resolve(q.result);
      q.onerror = () => reject(q.error);
    });
    if (!blob) throw new Error('Модель не установлена: ' + name);
    return blob;
  };
  const loader = { buffer: async (n) => (await get(n)).arrayBuffer(), text: async (n) => (await get(n)).text() };
  post({ type: 'progress', msg: 'python' });
  const pyodide = await loadPyodide({ indexURL: vendor + 'pyodide/' });
  engine = new SileroEngine.Engine(ort, pyodide, loader, (msg) => post({ type: 'progress', msg }));
  await engine.init();
}

self.onmessage = (e) => {
  const m = e.data;
  if (m.type === 'cancel') { const a = aborts.get(m.id); if (a) a.abort(); return; }
  queue = queue.then(async () => {
    try {
      if (m.type === 'init') {
        await init(m);
        post({ type: 'ready' });
      } else if (m.type === 'narrate') {
        const ac = new AbortController();
        aborts.set(m.id, ac);
        try {
          await engine.narrate(m.text, {
            speaker: m.speaker,
            pause: m.pause,
            signal: ac.signal,
            onChunk: (audio) => post({ type: 'chunk', id: m.id, audio }, [audio.buffer]),
          });
        } finally {
          aborts.delete(m.id);
        }
        post({ type: 'done', id: m.id });
      }
    } catch (err) {
      post({ type: 'error', id: m.id, message: String((err && err.message) || err) });
    }
  });
};
