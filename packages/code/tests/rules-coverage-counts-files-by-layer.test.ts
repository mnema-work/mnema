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
import { renderPlain } from '../src/presentation/plain.js';
import { coverageReport } from '../src/presentation/rules.js';
import { type CliIo, run } from '../src/program.js';
import { coverageByLayer } from '../src/rule-coverage.js';

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
  // 2 refused, 3 ask, 4 governed, 4 under none of the fixture's own, and 1 file inside
  // node_modules that is not counted. `init` writes four instruction files of its own
  // (AGENTS.md at the root, one each under .claude, .cursor and .github), also under none.
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

describe('mnema rules --coverage', { timeout: 60_000 }, () => {
  it('counts each file once, under the strongest layer, and per top-level folder', async () => {
    await arrange();
    const done = runRulesCoverage({ cwd: repo, env });
    if (!done.ok) throw new Error('refused');
    expect(done.coverage.files).toBe(17);
    expect(done.coverage.layers).toEqual({ refuses: 2, asks: 3, governs: 4, none: 8 });
    expect(done.coverage.folders).toEqual([
      { folder: '.', files: 2, refuses: 0, asks: 0, governs: 0, none: 2 },
      { folder: '.claude', files: 1, refuses: 0, asks: 0, governs: 0, none: 1 },
      { folder: '.cursor', files: 1, refuses: 0, asks: 0, governs: 0, none: 1 },
      { folder: '.github', files: 1, refuses: 0, asks: 0, governs: 0, none: 1 },
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
    expect(said.out).toContain(
      '17 files: 2 refused · 3 ask for a person · 4 governed · 8 under no rule',
    );
    expect(said.out).toContain('not counted, as not hand-written: .mnema, node_modules');
    expect(said.out).not.toContain('%');
    expect(said.out).not.toContain('floor');
  });

  it('says in --json what it says in words', async () => {
    await arrange();
    const said = await did('rules', '--coverage', '--json');
    expect(said.failed, said.err).toBe(false);
    const json = JSON.parse(said.out);
    expect(json.files).toBe(17);
    expect(json.layers).toEqual({ refuses: 2, asks: 3, governs: 4, none: 8 });
    expect(json.folders.map((f: { folder: string }) => f.folder)).toEqual([
      '.',
      '.claude',
      '.cursor',
      '.github',
      'docs',
      'src',
      'tools',
    ]);
    expect(json.truncated).toBe(false);
  });

  it('follows the gate: a layer whose channel is off counts under the next one, and says so', async () => {
    await arrange();
    await did('switch', 'off', 'edit-refuses-a-write');
    const done = runRulesCoverage({ cwd: repo, env });
    if (!done.ok) throw new Error('refused');
    // src/frozen/a.ts is also asked about, src/frozen/b.ts falls to none.
    expect(done.coverage.layers).toEqual({ refuses: 0, asks: 4, governs: 4, none: 9 });
    expect(done.coverage.switchedOff).toEqual(['edit-refuses-a-write']);
    const said = await did('rules', '--coverage');
    expect(said.out).toContain('switched off: edit-refuses-a-write');
    expect(said.out).toContain('0 refused · 4 ask for a person · 4 governed · 9 under no rule');
  });

  it('follows the gate when the asking is off, and when both are off', async () => {
    await arrange();
    await did('switch', 'off', 'edit-asks-a-person');
    const asksOff = runRulesCoverage({ cwd: repo, env });
    if (!asksOff.ok) throw new Error('refused');
    // the three ledger files are also governed, so they count there.
    expect(asksOff.coverage.layers).toEqual({ refuses: 2, asks: 0, governs: 7, none: 8 });
    expect(asksOff.coverage.switchedOff).toEqual(['edit-asks-a-person']);
    await did('switch', 'off', 'edit-refuses-a-write');
    const both = runRulesCoverage({ cwd: repo, env });
    if (!both.ok) throw new Error('refused');
    // frozen/a.ts was also asked about (now off), so both frozen files fall to none.
    expect(both.coverage.layers).toEqual({ refuses: 0, asks: 0, governs: 7, none: 10 });
    expect(both.coverage.switchedOff).toEqual(['edit-refuses-a-write', 'edit-asks-a-person']);
    const said = await did('rules', '--coverage');
    expect(said.out).toContain('switched off: edit-refuses-a-write, edit-asks-a-person');
  });

  it('counts only rules in force: not a proposed, superseded, unlinked, missing or differently cased address', async () => {
    const proposed = (await did('decision', 'record', 'Proposed only', 'why')).out.match(
      /\(([0-9a-f-]{20,})\)/,
    )?.[1] as string;
    await did('link', proposed, 'src/ledger', '--rel', 'refuses-a-write');
    const old = await ruleAt('Replaced rule', 'tools', 'refuses-a-write');
    const next = (await did('decision', 'record', 'Its successor', 'why')).out.match(
      /\(([0-9a-f-]{20,})\)/,
    )?.[1] as string;
    await did('decision', 'move', 'accept', next, '--note', 'agreed');
    const replaced = await did('decision', 'supersede', old, next, '--reason', 'newer');
    expect(replaced.failed, replaced.err).toBe(false);
    const taken = await ruleAt('Taken back', 'src/billing', 'refuses-a-write');
    const unlinked = await did(
      'unlink',
      taken,
      'src/billing',
      '--rel',
      'refuses-a-write',
      '--reason',
      'no',
    );
    expect(unlinked.failed, unlinked.err).toBe(false);
    await ruleAt('Names nothing', 'src/gone', 'asks-for-a-person');
    await ruleAt('Wrong case', 'Docs', 'governs');
    // The one that does count: in force, and held by the private tree.
    const made = await did('decision', 'record', 'Private rule', 'why', '--scope', 'private');
    const priv = made.out.match(/\(([0-9a-f-]{20,})\)/)?.[1] as string;
    await did('decision', 'move', 'accept', priv, '--note', 'agreed');
    const linked = await did('link', priv, 'src/other', '--rel', 'governs', '--scope', 'private');
    expect(linked.failed, linked.err).toBe(false);
    const done = runRulesCoverage({ cwd: repo, env });
    if (!done.ok) throw new Error('refused');
    expect(done.coverage.layers).toEqual({ refuses: 0, asks: 0, governs: 1, none: 16 });
  });

  it('counts a project with no rules wholly under none', async () => {
    const done = runRulesCoverage({ cwd: repo, env });
    if (!done.ok) throw new Error('refused');
    expect(done.coverage.layers).toEqual({ refuses: 0, asks: 0, governs: 0, none: 17 });
    // The count itself, over no record at all, says the same.
    expect(coverageByLayer([], repo).layers).toEqual({ refuses: 0, asks: 0, governs: 0, none: 17 });
  });

  it('stops at the walk ceiling and says every count is a floor', async () => {
    await arrange();
    const done = runRulesCoverage({ cwd: repo, env }, 5);
    if (!done.ok) throw new Error('refused');
    expect(done.coverage.truncated).toBe(true);
    expect(done.coverage.files).toBe(5);
    expect(done.coverage.ceiling).toBe(5);
    const cut = coverageByLayer([], repo, 3);
    expect(cut.truncated).toBe(true);
    expect(cut.files).toBe(3);
    const said = coverageReport(renderPlain, cut).join('\n');
    expect(said).toContain('the walk stopped at 3 files: every count here is a floor');
    expect(said).not.toContain('%');
  });

  it('asks for a path or --coverage, and for one of them only', async () => {
    const neither = await did('rules');
    expect(neither.failed).toBe(true);
    expect(neither.err).toContain('--coverage');
    const both = await did('rules', 'src', '--coverage');
    expect(both.failed).toBe(true);
    expect(both.err).toContain('no path');
  });

  it('refuses to count a folder that is not inside a project', () => {
    const bare = join(sandbox, 'bare');
    mkdirSync(bare);
    expect(runRulesCoverage({ cwd: bare, env })).toEqual({ ok: false, reason: 'NO_PROJECT' });
  });
});
