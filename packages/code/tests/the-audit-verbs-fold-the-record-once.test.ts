/**
 * THE AUDIT VERBS AND EXPORT FOLD THE RECORD ONCE, AND SAY WHERE A NEWER MNEMA WROTE FROM THAT FOLD.
 *
 * `audit exposure`, `audit antipatterns`, `export` and `site` read the tails themselves and open no cache.
 * The sentence about the lines a newer mnema wrote used to cost them a SECOND fold of the same tails
 * (a throwaway cache per tree, replayed and closed), about 40 percent on top of the verb. The fact is
 * on the reading they already take, so the answer is asked of that one.
 *
 * Two things are held, over a record a newer mnema wrote a line into (`support/a-newer-mnema-writes.ts`):
 * no projection cache is opened by the four, and the field they carry is still the one the sentence is
 * made of, written here as a literal and not recomputed from the code that counts it.
 *
 * The mutation that lights it: put `newerLinesOfTrees` (a replay through `withTreesRead`) back into one
 * of the four commands, and that verb is the one named.
 */

// @plants-damage

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ProjectionCache } from '@mnema/core';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { runAntipatterns } from '../src/commands/antipatterns.js';
import { runExport } from '../src/commands/export.js';
import { runExposure } from '../src/commands/exposure.js';
import { runSite } from '../src/commands/site.js';
import { aNewerMnemaWrites, FUTURE } from './support/a-newer-mnema-writes.js';
import { GIT_WITHOUT_MAINTENANCE } from './support/git-without-maintenance.js';
import { MNEMA_CLI } from './support/the-cli.js';

let sandbox: string;
let home: string;
let repo: string;

const env = () => ({
  PATH: process.env.PATH ?? '',
  HOME: home,
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_CONFIG_GLOBAL: GIT_WITHOUT_MAINTENANCE,
  GIT_AUTHOR_NAME: 'a',
  GIT_AUTHOR_EMAIL: 'a@example.invalid',
  GIT_COMMITTER_NAME: 'a',
  GIT_COMMITTER_EMAIL: 'a@example.invalid',
});

const mnema = (...argv: readonly string[]) => {
  const ran = spawnSync(process.execPath, [MNEMA_CLI, ...argv], {
    cwd: repo,
    encoding: 'utf-8',
    env: env(),
    timeout: 60_000,
  });
  expect(ran.status, `${argv.join(' ')}\n${ran.stderr}`).toBe(0);
};

const ctx = () => ({ cwd: repo, env: { home } });

beforeAll(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'mnema-one-fold-'));
  home = join(sandbox, 'home');
  repo = join(sandbox, 'repo');
  mkdirSync(home);
  mkdirSync(repo);
  mnema('init');
  mnema('decision', 'record', 'Use Postgres', 'The team knows it.');
  aNewerMnemaWrites({ record: join(repo, '.mnema'), home }, { means: 'something' });
}, 120_000);

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

const THE_LINE = { lines: 1, kinds: [{ kind: FUTURE, lines: 1 }] };

describe('the verbs that fold the tails themselves', () => {
  const verbs: readonly [string, () => { readonly newerLines?: unknown; readonly ok: boolean }][] =
    [
      ['audit exposure', () => runExposure(ctx())],
      ['audit antipatterns', () => runAntipatterns(ctx())],
      ['export', () => runExport(ctx())],
      ['site', () => runSite(ctx(), { out: join(sandbox, 'site') })],
    ];

  it.each(verbs)('%s opens no projection cache to learn what a newer mnema wrote', (_name, run) => {
    const opened = vi.spyOn(ProjectionCache, 'open');
    const done = run();
    expect(done.ok).toBe(true);
    expect(opened).not.toHaveBeenCalled();
  });

  it.each(verbs)('%s still carries the one line a newer mnema wrote', (_name, run) => {
    expect(run().newerLines).toEqual(THE_LINE);
  });
});
