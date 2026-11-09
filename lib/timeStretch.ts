/**
 * Changes the speed of mono speech by `rate` (2 = twice as fast) without changing its pitch.
 * WSOLA: Hann-windowed frames are taken `rate` times faster than they are laid down, each nudged to the
 * offset (searched on a decimated signal) that continues the previous frame most smoothly.
 */
export function timeStretch(x: Float32Array, rate: number): Float32Array {
  if (Math.abs(rate - 1) < 0.01 || x.length < 4096) return x;
  const N = 2048;
  const H = N / 2;
  const TOL = 480;
  const STEP = 4;

  const win = new Float32Array(N);
  for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N);

  const pad = new Float32Array(TOL + x.length + N + TOL);
  pad.set(x, TOL);

  const outLen = Math.ceil(x.length / rate);
  const y = new Float32Array(outLen + N);
  let prev = -1;
  for (let o = 0; o < outLen; o += H) {
    let s = Math.round(o * rate);
    if (prev >= 0) {
      const target = prev + H;
      let best = -Infinity;
      let at = s;
      for (let d = -TOL; d <= TOL; d += STEP) {
        const c = s + d;
        if (c < 0) continue;
        let sum = 0;
        for (let i = 0; i < N; i += STEP) sum += pad[TOL + c + i] * pad[TOL + target + i];
        if (sum > best) { best = sum; at = c; }
      }
      s = at;
    }
    for (let i = 0; i < N; i++) y[o + i] += pad[TOL + s + i] * win[i];
    prev = s;
  }
  return y.subarray(0, outLen);
}
