// @reads-the-tree
/**
 * THE `bin` RUNS THE BUNDLE, AND THE TESTS RUN WHAT THE `bin` NAMES.
 *
 * `mnema` as npm installs it is the file the `bin` of `package.json` names, and that is the entry
 * `build/the-cli-bundle.mjs` writes in `dist/bundle/`. A test that starts the CLI starts it through
 * `tests/support/the-cli.ts`, which reads the `bin`, so the suite proves the artefact a user runs.
 * A test that spells the compiled `dist/cli.js` as the program to start would prove the other
 * build in silence: only the tests that mean that build, listed below with why, may.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { literalsOnly } from './support/reading-source.js';
import { MNEMA_CLI } from './support/the-cli.js';
import { theDifference } from './support/the-difference.js';

const REPO = fileURLToPath(new URL('../../../', import.meta.url));
const PACKAGE = join(REPO, 'packages', 'code');

/** Where `build/the-cli-bundle.mjs` writes the bundle's entry. */
const BUNDLE_ENTRY = join(PACKAGE, 'dist', 'bundle', 'cli.js');

/**
 * The compiled entry, in the string literals of a test: one path (`'../dist/cli.js'`), or its
 * parts as arguments of a `join` (`'dist', 'cli.js'`), where the literals' edges sit between.
 */
const THE_COMPILED_ENTRY = /dist\/cli\.js|\bdist[^A-Za-z/]{1,12}cli\.js/;

/** The tests that name the compiled entry on purpose. */
const MEANT: Readonly<Record<string, string>> = {
  'packages/code/tests/the-bundle-says-what-the-compiled-cli-says.test.ts':
    'compares what the two builds print',
  'packages/code/tests/the-node-below-the-floor-is-refused.test.ts':
    'runs the floor check on each entry the package carries',
  'packages/code/tests/the-plugin-spawns-what-the-package-installs.test.ts':
    'writes a `bin` of its own into a manifest it reads, and starts nothing',
  'packages/code/tests/the-runtime-floor-is-declared-once.test.ts':
    'reads the CI step that runs the floor check on the compiled entry, and starts nothing',
  'packages/core/src/boundaries.test.ts': 'a module specifier the import walk must recognize',
};

function testsNamingTheCompiledEntry(): string[] {
  return execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
    cwd: REPO,
    encoding: 'utf-8',
  })
    .split('\n')
    .filter((file) => /\.test\.tsx?$/.test(file))
    .filter((file) => {
      try {
        return THE_COMPILED_ENTRY.test(literalsOnly(readFileSync(join(REPO, file), 'utf-8')));
      } catch {
        return false;
      }
    })
    .sort();
}

describe('the bin of @mnema/code', () => {
  it('names the entry the bundle step writes', () => {
    const { bin } = JSON.parse(readFileSync(join(PACKAGE, 'package.json'), 'utf-8')) as {
      bin: Record<string, string>;
    };
    expect(
      Object.keys(bin),
      'packages/code/package.json: the bin must hold the single entry "mnema"',
    ).toEqual(['mnema']);
    expect(
      join(PACKAGE, bin.mnema ?? ''),
      'packages/code/package.json: point bin.mnema at dist/bundle/cli.js, the entry packages/code/build/the-cli-bundle.mjs writes',
    ).toBe(BUNDLE_ENTRY);
    expect(
      MNEMA_CLI,
      'packages/code/tests/support/the-cli.ts: read the bin of packages/code/package.json, do not spell another entry',
    ).toBe(BUNDLE_ENTRY);
    expect(
      existsSync(BUNDLE_ENTRY),
      'packages/code/dist/bundle/cli.js is missing: run pnpm build before the tests',
    ).toBe(true);
  });

  it('is what every test that starts the CLI starts, but those that mean the compiled build', () => {
    const naming = testsNamingTheCompiledEntry();
    const meant = Object.keys(MEANT).sort();
    expect(
      naming,
      theDifference(
        naming,
        meant,
        'Start the CLI through packages/code/tests/support/the-cli.ts instead of spelling the compiled entry, or list the test in MEANT with why',
        'Remove from MEANT (the test no longer names the compiled entry)',
      ),
    ).toEqual(meant);
  });
});
