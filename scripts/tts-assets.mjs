// Copies the in-browser narrator's runtime (onnxruntime-web, Pyodide) into public/tts/vendor.
// The ONNX nets, data files and Python sources are NOT bundled: they are uploaded to the backend
// (tts/export/README.md) and installed by listeners on demand.
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'public', 'tts');
const copy = (from, to) => { mkdirSync(dirname(to), { recursive: true }); copyFileSync(from, to); };

const ort = join(root, 'node_modules', 'onnxruntime-web', 'dist');
for (const f of ['ort.wasm.min.js', 'ort-wasm-simd-threaded.wasm', 'ort-wasm-simd-threaded.mjs']) copy(join(ort, f), join(out, 'vendor', 'ort', f));

const py = join(root, 'node_modules', 'pyodide');
for (const f of ['pyodide.js', 'pyodide.asm.js', 'pyodide.asm.wasm', 'python_stdlib.zip', 'pyodide-lock.json']) copy(join(py, f), join(out, 'vendor', 'pyodide', f));

console.log('tts runtime ready in public/tts/vendor (models are served by the backend: php src/cli/tts_upload.php <dir>)');
