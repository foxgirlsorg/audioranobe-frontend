// Verification build that writes to .next-build instead of .next.
//
// Running `next build` against .next while `next dev` is using it leaves
// production manifests behind; dev then loads the production runtime out of
// them and every page 500s with "TypeError: e[o] is not a function". This lets
// a build be run at any time, dev server or not.
//
// Cross-platform on purpose: `VAR=x next build` is not valid in cmd/PowerShell.

import { spawnSync } from 'node:child_process';

const result = spawnSync('npx', ['next', 'build'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, NEXT_DIST_DIR: '.next-build' },
});

process.exit(result.status ?? 1);
