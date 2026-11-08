/**
 * THE PROGRAM A USER'S INSTALL RUNS: the file the `bin` of `packages/code/package.json` names,
 * read from the manifest npm reads, so a test that starts the CLI starts the artefact npm links
 * onto the PATH (the bundle in `dist/bundle/`) and follows it if the `bin` ever moves.
 *
 * A test that means the compiled `dist/cli.js` on purpose names it itself: the one that compares
 * the two builds, and the one that runs the floor check on each entry.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE = fileURLToPath(new URL('../../', import.meta.url));

const manifest = JSON.parse(readFileSync(join(PACKAGE, 'package.json'), 'utf-8')) as {
  bin: { mnema: string };
};

/** The absolute path of the built CLI a user's install runs. */
export const MNEMA_CLI = join(PACKAGE, manifest.bin.mnema);
