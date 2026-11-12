// @reads-the-tree
/**
 * EVERY MODULE THAT FINDS ITS OWN FILES IS LISTED, WITH WHY IT HOLDS IN THE BUNDLE.
 *
 * `build/the-cli-bundle.mjs` moves the code of five packages into chunks of `dist/bundle/`. A
 * module that finds a file by its own place (`import.meta.url`, `__dirname`, `__filename`, or a
 * `require` made with `createRequire`) is then somewhere else, and a path that was true beside it
 * names nothing. That is how the bundle once silenced the Node floor (`../package.json`) and died
 * on every verb that writes (the cache stamp hashed files that were not there).
 *
 * So every such reader in the source the bundle carries is listed here with the reason it holds
 * in the bundle. A new reader without an entry is red, and so is an entry whose file no longer
 * reads its own place. The packages are the ones `@mnema/code` depends on in the workspace, and
 * itself, read from its `package.json`.
 */

import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { codeOnly, sourceFiles } from './support/reading-source.js';
import { theDifference } from './support/the-difference.js';

const PACKAGE = fileURLToPath(new URL('../', import.meta.url));
const PACKAGES = join(PACKAGE, '..');
const REPO = join(PACKAGES, '..');

const READS_ITS_OWN_PLACE = /\bimport\.meta\b|\b__dirname\b|\b__filename\b|\bcreateRequire\b/;

/** Each reader, by path from the repository, and why it holds in the bundle. */
const LISTED: Readonly<Record<string, string>> = {
  'packages/chain/src/events/schema.ts':
    'builds the URL of the schema file at load and reads nothing; only the tests read the file',
  'packages/chain/src/events/vectors.ts':
    'builds the URL of the vectors file at load and reads nothing; only the tests read the file',
  'packages/code/src/cli.ts':
    'compares its own URL with the path it was run by; the bundled entry is the file that is run',
  'packages/code/src/package-root.ts':
    'walks up from its chunk to the folder whose package.json is this package, at any depth',
  'packages/code/src/presentation/width.ts':
    'requires string-width, which the bundle leaves outside, so it resolves from node_modules above the chunk',
  'packages/core/src/projections/cache-meta.ts':
    'the bundle writes the stamp in as a constant; its own folder is read only outside the bundle',
};

function theBundledPackages(): string[] {
  const manifest = JSON.parse(readFileSync(join(PACKAGE, 'package.json'), 'utf-8')) as {
    dependencies: Record<string, string>;
  };
  const workspace = Object.entries(manifest.dependencies)
    .filter(([, range]) => range.startsWith('workspace:'))
    .map(([name]) => name.replace('@mnema/', ''));
  return ['code', ...workspace].sort();
}

function readers(): string[] {
  return theBundledPackages()
    .flatMap((name) => sourceFiles(join(PACKAGES, name, 'src')))
    .filter((file) => READS_ITS_OWN_PLACE.test(codeOnly(readFileSync(file, 'utf-8'))))
    .map((file) => relative(REPO, file).split('\\').join('/'))
    .sort();
}

describe('the modules the bundle carries that find their own files', () => {
  it('reads the workspace packages the CLI is built from', () => {
    expect(
      theBundledPackages(),
      'The packages the CLI is built from changed: update this list, and check build/the-cli-bundle.mjs still carries them',
    ).toEqual(['chain', 'code', 'context', 'core', 'stacks']);
  });

  it('are each listed with why they hold in the bundle, and the list names no other', () => {
    const found = readers();
    const listed = Object.keys(LISTED).sort();
    expect(
      found,
      theDifference(
        found,
        listed,
        'Add to LISTED, with why it holds in the bundle, or stop it reading its own place',
        'Remove from LISTED (the file no longer reads its own place, or is gone)',
      ),
    ).toEqual(listed);
  });
});
