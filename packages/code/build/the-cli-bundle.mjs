/**
 * Builds the CLI as one bundle: `dist/cli.js`, as the compiler left it, and everything it reaches,
 * folded into `dist/bundle/` by esbuild.
 *
 * WHAT IS INSIDE. The four workspace packages and their third-party dependencies, except two:
 * `string-width`, which `presentation/width.ts` loads with a `require` at run time that a bundler
 * cannot follow, and `react-devtools-core`, which ink imports only in its development mode and
 * which is not installed. Both stay as imports of the installed package.
 *
 * WHY IT IS SPLIT. An ES module is linked before its first line runs, so a single file would link
 * `node:sqlite` before the Node floor check speaks (`src/cli.ts` says why that matters). With
 * splitting on, every `import()` of the source stays a chunk of its own, and the entry `cli.js`
 * links only the floor check and what it needs; `tests/the-bundle-links-nothing-before-the-floor.test.ts`
 * walks the entry's static imports and holds it.
 *
 * WHAT IS FIXED AT BUILD TIME. `productStamp()` of `@mnema/core` hashes the files of its own
 * directory when it runs; in a bundle those files are not there. The build computes the stamp the
 * compiled package computes, from the same files, and writes it into the bundle as a constant, so
 * a cache built by one is read as current by the other.
 *
 * React and some of the dependencies are CommonJS, which calls `require`; an ES module has none, so
 * each chunk opens by making one. Not minified, so a stack trace names a line a person can read;
 * no source maps are written, so none is published.
 */

import { rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const here = new URL('.', import.meta.url);
const packageRoot = fileURLToPath(new URL('..', here));

/** Where the bundle goes: beside the compiler's output, in a folder of its own. */
export const BUNDLE_DIR = fileURLToPath(new URL('../dist/bundle', here));

/** What stays an import of the installed package instead of being folded in. */
export const LEFT_OUTSIDE = ['string-width', 'react-devtools-core'];

/** The name the constant has in `packages/core/src/projections/cache-meta.ts`. */
const STAMP = 'MNEMA_PRODUCT_STAMP';

const REQUIRE =
  "import { createRequire as __mnemaCreateRequire } from 'node:module'; const require = __mnemaCreateRequire(import.meta.url);";

/** Writes the bundle into `outdir` (the build's own folder unless a test names another). */
export async function bundleTheCli(outdir = BUNDLE_DIR) {
  const { productStamp } = await import(
    new URL('../../core/dist/projections/cache-meta.js', here).href
  );
  rmSync(outdir, { recursive: true, force: true });
  return build({
    entryPoints: { cli: fileURLToPath(new URL('../dist/cli.js', here)) },
    absWorkingDir: packageRoot,
    outdir,
    bundle: true,
    splitting: true,
    platform: 'node',
    format: 'esm',
    target: 'node24',
    minify: false,
    sourcemap: false,
    external: LEFT_OUTSIDE,
    define: { [STAMP]: JSON.stringify(productStamp()) },
    banner: { js: REQUIRE },
    logLevel: 'warning',
    // `import.meta` is ESM's own and the output is ESM: nothing is emptied.
    logOverride: { 'empty-import-meta': 'silent' },
    metafile: true,
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await bundleTheCli();
