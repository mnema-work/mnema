/**
 * `mnema rules --coverage`: how many of the project's files fall under each layer of the record's
 * rules, with no score. A file is counted once, under the strongest layer over it: a rule that
 * refuses a write, then one that asks for a person, then one that governs, then none.
 *
 * The expected counts are written out by value from the files the fixture creates, never derived
 * from the code under test.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { DiscoveryEnv } from '@mnema/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runRulesCoverage } from '../src/commands/rules.js';
import { type CliIo, run } from '../src/program.js';

let sandbox: string;
let repo: string;
let env: DiscoveryEnv;
let originalCwd: string;
let originalHome: string | undefined;

async function did(...argv: string[]): Promise<{ out: string; err: string; failed: boolean }> {
  const out: string[] = [];
  const err: string[] = [];
  let failed = false;
  const io: CliIo = {
    out: (l) => out.push(l),
    err: (l) => err.push(l),
    fail: () => {
      failed = true;
    },
  };
  await run(argv, io);
  return { out: out.join('\n'), err: err.join('\n'), failed };
}

/** Records a decision, accepts it, and addresses it at `path` under `rel`. */
async function ruleAt(title: string, path: string, rel: string): Promise<string> {
  const made = await did('decision', 'record', title, `why ${title}`);
  const id = made.out.match(/\(([0-9a-f-]{20,})\)/)?.[1] as string;
  await did('decision', 'move', 'accept', id, '--note', 'agreed');
  const linked = await did('link', id, path, '--rel', rel);
  expect(linked.failed, linked.err).toBe(false);
  return id;
}

function files(...paths: string[]): void {
  for (const path of paths) {
    mkdirSync(join(repo, path, '..'), { recursive: true });
    writeFileSync(join(repo, path), 'x\n');
  }
}

beforeEach(async () => {
  sandbox = mkdtempSync(join(tmpdir(), 'mnema-coverage-'));
  repo = join(sandbox, 'repo');
  mkdirSync(repo);
  mkdirSync(join(sandbox, 'home'));
  originalCwd = process.cwd();
  originalHome = process.env.HOME;
  process.env.HOME = join(sandbox, 'home');
  env = { home: join(sandbox, 'home') };
  process.chdir(repo);
  await did('init');
  // 2 refused, 3 ask, 4 governed (one of them also under a weaker layer's reach), 5 under none
  // (the two root files count under `.`), and 1 file inside node_modules that is not counted.
  files(
    'src/frozen/a.ts',
    'src/frozen/b.ts',
    'src/ledger/a.ts',
    'src/ledger/b.ts',
    'src/ledger/c.ts',
    'src/billing/a.ts',
    'src/billing/b.ts',
    'docs/guide.md',
    'docs/more.md',
    'src/other/x.ts',
    'tools/run.sh',
    'tools/two.sh',
    'README.md',
    'node_modules/dep/index.js',
  );
});

afterEach(() => {
  process.chdir(originalCwd);
  if (originalHome === undefined) delete process.env.HOME;
  else process.env.HOME = originalHome;
  rmSync(sandbox, { recursive: true, force: true });
});

async function arrange(): Promise<void> {
  await ruleAt('Frozen code stays', 'src/frozen', 'refuses-a-write');
  await ruleAt('Ledger needs finance', 'src/ledger', 'asks-for-a-person');
  await ruleAt('Billing is UTC', 'src/billing', 'governs');
  await ruleAt('Docs are reviewed', 'docs', 'governs');
  // Two layers over one directory: the strongest wins and the file is counted once.
  await ruleAt('Ledger is also governed', 'src/ledger', 'governs');
  await ruleAt('Frozen is also asked about', 'src/frozen/a.ts', 'asks-for-a-person');
}

describe('mnema rules --coverage', () => {
  it('counts each file once, under the strongest layer, and per top-level folder', async () => {
    await arrange();
    const done = runRulesCoverage({ cwd: repo, env });
    if (!done.ok) throw new Error('refused');
    expect(done.coverage.files).toBe(13);
    expect(done.coverage.layers).toEqual({ refuses: 2, asks: 3, governs: 4, none: 4 });
    expect(done.coverage.folders).toEqual([
      { folder: '.', files: 1, refuses: 0, asks: 0, governs: 0, none: 1 },
      { folder: 'docs', files: 2, refuses: 0, asks: 0, governs: 2, none: 0 },
      { folder: 'src', files: 8, refuses: 2, asks: 3, governs: 2, none: 1 },
      { folder: 'tools', files: 2, refuses: 0, asks: 0, governs: 0, none: 2 },
    ]);
    expect(done.coverage.skipped).toEqual(['.mnema', 'node_modules']);
    expect(done.coverage.truncated).toBe(false);
  });

  it('prints numbers and no percentage, and says what is not counted', async () => {
    await arrange();
    const said = await did('rules', '--coverage');
    expect(said.failed, said.err).toBe(false);
    expect(said.out).toContain('13 files: 2 refused · 3 ask for a person · 4 governed · 4 under no rule');
    expect(said.out).toContain('not counted, as not hand-written: .mnema, node_modules');
    expect(said.out).not.toContain('%');
    expect(said.out).not.toContain('floor');
  });

  it('says in --json what it says in words', async () => {
    await arrange();
    const said = await did('rules', '--coverage', '--json');
    expect(said.failed, said.err).toBe(false);
    const json = JSON.parse(said.out);
    expect(json.files).toBe(13);
    expect(json.layers).toEqual({ refuses: 2, asks: 3, governs: 4, none: 4 });
    expect(json.folders.map((f: { folder: string }) => f.folder)).toEqual([
      '.',
      'docs',
      'src',
      'tools',
    ]);
    expect(json.truncated).toBe(false);
  });

  it('counts a project with no rules wholly under none', async () => {
    const done = runRulesCoverage({ cwd: repo, env });
    if (!done.ok) throw new Error('refused');
    expect(done.coverage.layers).toEqual({ refuses: 0, asks: 0, governs: 0, none: 13 });
  });

  it('stops at the walk ceiling and says every count is a floor', async () => {
    await arrange();
    const done = runRulesCoverage({ cwd: repo, env }, 5);
    if (!done.ok) throw new Error('refused');
    expect(done.coverage.truncated).toBe(true);
    expect(done.coverage.files).toBe(5);
    expect(done.coverage.ceiling).toBe(5);
  });

  it('asks for a path or --coverage, and for one of them only', async () => {
    const neither = await did('rules');
    expect(neither.failed).toBe(true);
    expect(neither.err).toContain('--coverage');
    const both = await did('rules', 'src', '--coverage');
    expect(both.failed).toBe(true);
    expect(both.err).toContain('no path');
  });
});
