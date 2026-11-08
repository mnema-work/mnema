/**
 * The script a generated page runs, as the build left it.
 *
 * `build/the-site-verifier.mjs` writes `dist/site-verifier.js` after the compiler runs. The file
 * is named from the package's root (`package-root.ts`), which holds for the source, its compiled
 * copy and the bundle alike, and a missing file says what to run instead of writing a page that
 * cannot verify anything.
 */

import { readFileSync } from 'node:fs';
import { packageFile } from '../package-root.js';

const BUNDLE = packageFile('dist/site-verifier.js');

/** The verifier script's text. */
export function theSiteVerifier(): string {
  try {
    return readFileSync(BUNDLE, 'utf-8');
  } catch {
    throw new Error(`the site verifier is not built (${BUNDLE}): run \`pnpm build\``);
  }
}
