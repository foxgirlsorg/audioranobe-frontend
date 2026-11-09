/* Silero v5.5 RU in the browser: ONNX nets (onnxruntime-web) + the Python text front end (Pyodide).
 * Line-for-line port of tts/export/numeric.py; verified against the original package by tts/export/parity.py.
 * Classic script: works in a Web Worker (importScripts) and in Node (require) alike. */
(function (root) {
  'use strict';

  const SAMPLE_RATE = 48000;
  const PAUSE_SECONDS = 0.35;
  const N_FFT = 2400;
  const HOP = 600;
  const PAD = (N_FFT - HOP) / 2;

  // ── inverse real FFT of arbitrary size with small prime factors (2400 = 2^5·3·5^2) ──────────
  function factorize(n) {
    const f = [];
    for (let p = 2; n > 1; p++) while (n % p === 0) { f.push(p); n /= p; }
    return f;
  }

  function makeIrfft(N) {
    const factors = factorize(N);
    const twRe = new Float64Array(N);
    const twIm = new Float64Array(N);
    for (let k = 0; k < N; k++) { twRe[k] = Math.cos(2 * Math.PI * k / N); twIm[k] = Math.sin(2 * Math.PI * k / N); } // e^{+i}
    const xr = new Float64Array(N), xi = new Float64Array(N), yr = new Float64Array(N), yi = new Float64Array(N);
    const tr = new Float64Array(8), ti = new Float64Array(8);

    function rec(io, is, oo, n, fi) {
      if (n === 1) { yr[oo] = xr[io]; yi[oo] = xi[io]; return; }
      const p = factors[fi], m = n / p, tws = N / n;
      for (let j = 0; j < p; j++) rec(io + j * is, is * p, oo + j * m, m, fi + 1);
      const wps = N / p;
      for (let k = 0; k < m; k++) {
        for (let j = 0; j < p; j++) {
          const a = (j * k * tws) % N, r = yr[oo + j * m + k], i = yi[oo + j * m + k];
          tr[j] = r * twRe[a] - i * twIm[a];
          ti[j] = r * twIm[a] + i * twRe[a];
        }
        for (let q = 0; q < p; q++) {
          let sr = 0, si = 0;
          for (let j = 0; j < p; j++) {
            const a = (j * q * wps) % N;
            sr += tr[j] * twRe[a] - ti[j] * twIm[a];
            si += tr[j] * twIm[a] + ti[j] * twRe[a];
          }
          yr[oo + k + q * m] = sr; yi[oo + k + q * m] = si;
        }
      }
    }

    /** spectrum of bins 0..N/2 (re/im strided by `stride`, offset `off`) -> `out` real signal (numpy.fft.irfft). */
    return function irfft(re, im, off, stride, out) {
      const half = N / 2;
      for (let k = 0; k <= half; k++) {
        const r = re[off + k * stride];
        const i = (k === 0 || k === half) ? 0 : im[off + k * stride];
        xr[k] = r; xi[k] = i;
        if (k > 0 && k < half) { xr[N - k] = r; xi[N - k] = -i; }
      }
      rec(0, 1, 0, N, 0);
      for (let n = 0; n < N; n++) out[n] = yr[n] / N;
    };
  }

  /** re/im: Float32Array [1201, T] (row-major) -> audio Float32Array, torch.istft(padding='same'). */
  function istft(re, im, T, window, irfft) {
    const bins = N_FFT / 2 + 1;
    const len = (T - 1) * HOP + N_FFT;
    const y = new Float64Array(len), env = new Float64Array(len), frame = new Float64Array(N_FFT);
    for (let t = 0; t < T; t++) {
      irfft(re, im, t, T, frame);
      const base = t * HOP;
      for (let n = 0; n < N_FFT; n++) {
        y[base + n] += frame[n] * window[n];
        env[base + n] += window[n] * window[n];
      }
    }
    const out = new Float32Array(len - 2 * PAD);
    for (let n = 0; n < out.length; n++) out[n] = y[n + PAD] / env[n + PAD];
    return out;
  }

  const rowsOf = (t) => {
    const [r, c] = t.dims, rows = [];
    for (let i = 0; i < r; i++) rows.push(Array.from(t.data.subarray(i * c, (i + 1) * c)));
    return rows;
  };

  class Engine {
    /**
     * @param ort      onnxruntime-web namespace
     * @param pyodide  loaded Pyodide instance (global `unicode_category` must be set by the caller)
     * @param loader   {buffer(name)->Promise<ArrayBuffer>, text(name)->Promise<string>}
     * @param log      optional progress callback (message)
     */
    constructor(ort, pyodide, loader, log) {
      this.ort = ort; this.py = pyodide; this.load = loader; this.log = log || (() => {});
    }

    async init() {
      const { ort, py, load, log } = this;
      const session = async (n) => { log('model ' + n); return ort.InferenceSession.create(new Uint8Array(await load.buffer(n + '.onnx')), { executionProviders: ['wasm'], graphOptimizationLevel: 'all' }); };
      this.s = {};
      for (const n of ['dur', 'pitch', 'enc', 'dec', 'voc', 'accent', 'homo']) this.s[n] = await session(n);
      this.window = new Float32Array(await load.buffer('istft_window.f32'));
      this.emb = new Float32Array(await load.buffer('accent_emb.f32'));
      this.irfft = makeIrfft(N_FFT);

      log('text front end');
      py.FS.mkdirTree('/tts');
      for (const f of ['meta.json', 'ngrams.txt', 'exceptions.json', 'homodict.json', 'vocab.txt']) {
        py.FS.writeFile('/tts/' + f, await load.text(f));
      }
      py.FS.writeFile('/tts/rutextnorm.py', await load.text('rutextnorm.py'));
      py.FS.writeFile('/tts/frontend.py', await load.text('frontend.py'));
      py.runPython('import sys; sys.path.insert(0, "/tts")');
      this.fe = py.pyimport('frontend');
      this.data = this.fe.load_data('/tts');
      this.speakers = JSON.parse(await load.text('meta.json')).speakers;
      this.accentCb = (req) => this.accent(req);
      this.homoCb = (req) => this.homo(req);
    }

    async accent(js) {
      const { ind, offsets } = JSON.parse(js), n = offsets.length;
      const e = new Float32Array(n * 16);
      for (let w = 0; w < n; w++) {
        const a = offsets[w], b = w + 1 < n ? offsets[w + 1] : ind.length;
        for (let i = a; i < b; i++) for (let d = 0; d < 16; d++) e[w * 16 + d] += this.emb[ind[i] * 16 + d];
        for (let d = 0; d < 16; d++) e[w * 16 + d] /= (b - a);
      }
      const r = await this.s.accent.run({ emb: new this.ort.Tensor('float32', e, [n, 16]) });
      return JSON.stringify({ stress: rowsOf(r.stress), yo: rowsOf(r.yo) });
    }

    async homo(js) {
      const { ids, start, end } = JSON.parse(js), B = ids.length, L = ids[0].length;
      const big = (a) => BigInt64Array.from(a, (v) => BigInt(v));
      const r = await this.s.homo.run({
        ids: new this.ort.Tensor('int64', big(ids.flat()), [B, L]),
        start: new this.ort.Tensor('int64', big(start), [B]),
        end: new this.ort.Tensor('int64', big(end), [B]),
      });
      return JSON.stringify(Array.from(r.logits.data));
    }

    /** Sequence/type ids for one chunk -> mono Float32Array @48 kHz. */
    async synthChunk(seq, typeIds, speakerId) {
      const { ort, s } = this, T = seq.length;
      const i64 = (a, dims) => new ort.Tensor('int64', BigInt64Array.from(a, (v) => BigInt(v)), dims);
      const sq = i64(seq, [1, T]), spk = i64([speakerId], [1]), tid = i64(typeIds, [1, T]);

      const logDur = (await s.dur.run({ seq: sq, spk })).log_dur.data;
      const d = new Float32Array(T);
      for (let i = 0; i < T; i++) { const v = Math.exp(logDur[i]) - 1; d[i] = roundEven(v < 0 ? 0 : v); }
      if (d[0] > 5) d[0] = 5;
      if (d[T - 1] > 7) d[T - 1] = 7;
      d[T - 2] = 13;
      if (d[T - 3] > 13) d[T - 3] = 13;

      const pitch = (await s.pitch.run({ seq: sq, spk, tid })).pitch;
      const pd = pitch.data;
      for (let i = 0; i < pd.length; i++) if (Math.abs(pd[i]) < 0.001) pd[i] = 0;

      const enc = (await s.enc.run({ seq: sq, spk, pitch })).enc.data; // [1, T, 128]
      let frames = 0;
      const reps = new Int32Array(T);
      for (let i = 0; i < T; i++) { reps[i] = Math.trunc(d[i] + 0.5); frames += reps[i]; }
      const x = new Float32Array(frames * 128);
      let o = 0;
      for (let i = 0; i < T; i++) for (let r = 0; r < reps[i]; r++) { x.set(enc.subarray(i * 128, (i + 1) * 128), o); o += 128; }

      const mel = (await s.dec.run({ x: new ort.Tensor('float32', x, [1, frames, 128]) })).mel;
      const v = await s.voc.run({ mel });
      return istft(v.re.data, v.im.data, v.re.dims[2], this.window, this.irfft);
    }

    /**
     * Narrate a whole text like the narrator node: normalize, split, synthesize each piece, 0.35 s of silence after each.
     * Calls onChunk(Float32Array) per piece (audio + pause); returns when done.
     */
    async narrate(text, { speaker = 'xenia', onChunk, signal, pause: pauseSeconds = PAUSE_SECONDS } = {}) {
      const speakerId = this.speakers[speaker] ?? 0;
      const pause = new Float32Array(Math.floor(SAMPLE_RATE * pauseSeconds));
      const pieces = this.fe.split_text(this.fe.normalize(text)).toJs();
      for (const piece of pieces) {
        if (signal && signal.aborted) return;
        let audio;
        try {
          const r = await this.fe.prepare(piece, this.data, this.accentCb, this.homoCb);
          const [seq, typeIds] = r.toJs();
          r.destroy();
          audio = await this.synthChunk(seq, typeIds, speakerId);
        } catch (e) {
          this.log('chunk skipped: ' + (e && e.message ? e.message.split('\n').slice(-2)[0] : e));
          continue; // like the node: an unsynthesisable fragment is dropped
        }
        const out = new Float32Array(audio.length + pause.length);
        out.set(audio);
        if (onChunk) await onChunk(out);
      }
    }
  }

  /** torch.round / numpy.round: ties to even. */
  function roundEven(v) {
    const f = Math.floor(v), diff = v - f;
    if (diff < 0.5) return f;
    if (diff > 0.5) return f + 1;
    return f % 2 === 0 ? f : f + 1;
  }

  const api = { Engine, makeIrfft, istft, SAMPLE_RATE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SileroEngine = api;
})(typeof self !== 'undefined' ? self : globalThis);
