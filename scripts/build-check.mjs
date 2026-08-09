// Verification build. Runs `next build` into a throwaway dist dir so it never
// clobbers the dev server's live `.next` (which, if overwritten with the
// production runtime, makes dev die with "TypeError: e[o] is not a function").
// See distDir in next.config.mjs.
import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = '.next-build';
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';

const res = spawnSync(npx, ['next', 'build'], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, NEXT_DIST_DIR: DIST },
  shell: process.platform === 'win32',
});

// Best-effort cleanup; a leftover throwaway dir is harmless but noisy.
try {
  rmSync(join(root, DIST), { recursive: true, force: true });
} catch {}

process.exit(res.status ?? 1);
