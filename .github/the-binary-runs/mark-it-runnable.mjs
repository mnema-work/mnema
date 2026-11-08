// Marks the built CLI executable, last in `pnpm build`: the entry the `bin` of
// `packages/code/package.json` names (the bundle, `dist/bundle/cli.js`) and the compiled
// `dist/cli.js` it is built from.
//
// `tsc` and esbuild write every output file with the default mode (0664) and keep no executable
// bit, so a clone that builds and then links the entry onto the PATH (the way to run mnema from
// source) got `Permission denied`, exit 126, on the very last step of the install. npm sets the
// bit itself when it installs a package's `bin`; a source build does not. The compiled entry is
// marked too, so a link made to it by an earlier build still runs.
//
// It adds the execute bit for whoever may already read the file and touches nothing else, and
// it FAILS when a file is not there: a build that produced no binary is not a build. It runs after
// the bundle step, which empties `dist/bundle/` first.
// `packages/code/tests/the-built-binary-runs-from-a-symlink.test.ts` holds the result.

import { chmodSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const packageRoot = new URL('../../packages/code/', import.meta.url);
const { bin } = JSON.parse(readFileSync(new URL('package.json', packageRoot), 'utf-8'));

for (const entry of [bin.mnema, './dist/cli.js']) {
  const binary = fileURLToPath(new URL(entry, packageRoot));
  const { mode } = statSync(binary);
  chmodSync(binary, mode | ((mode & 0o444) >> 2));
}
