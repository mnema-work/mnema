/**
 * `mnema rules test <file>` checks the verdicts a file declares for paths against the record's
 * rules, with the gate's own function. A file that every path meets passes and exits 0; one that a
 * path misses names each miss, with what the path met and the rules behind it, and exits 1; a rule
 * unlinked from a path makes the case that relied on it fail, which is what the verb is for.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type CliIo, run } from '../src/program.js';

let sandbox: string;
let repo: string;
const before = { cwd: process.cwd(), home: process.env.HOME, run: process.env.MNEMA_RUN };
const ids: Record<string, string> = {};

beforeEach(async () => {
  sandbox = mkdtempSync(join(tmpdir(), 'mnema-rules-test-'));
  repo = join(sandbox, 'repo');
  for (const dir of ['billing', 'ledger', 'docs']) mkdirSync(join(repo, 'src', dir), { recursive: true });
  mkdirSync(join(sandbox, 'home'));
  process.env.HOME = join(sandbox, 'home');
  delete process.env.MNEMA_RUN;
  process.chdir(repo);
  await mnema('init');
  for (const [name, dir, relation] of [
    ['Never edit billing', 'src/billing', 'refuses-a-write'],
    ['Ask before the ledger', 'src/ledger', 'asks-for-a-person'],
    ['Docs follow the style guide', 'src/docs', 'governs'],
  ] as const) {
    const said = await mnema('decision', 'record', name, 'because');
    const id = said.out.match(/\(([0-9a-f-]{20,})\)/)?.[1] as string;
    await mnema('decision', 'move', 'accept', id, '--note', 'agreed');
    await mnema('link', id, dir, '--rel', relation);
    ids[dir] = id;
  }
});

afterEach(() => {
  process.chdir(before.cwd);
  if (before.home === undefined) delete process.env.HOME;
  else process.env.HOME = before.home;
  if (before.run !== undefined) process.env.MNEMA_RUN = before.run;
  rmSync(sandbox, { recursive: true, force: true });
});

async function mnema(...argv: string[]): Promise<{ out: string; err: string; failed: boolean }> {
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
  await run(['--color=never', ...argv], io);
  return { out: out.join('\n'), err: err.join('\n'), failed };
}

function declare(...cases: [string, string][]): string {
  const file = join(sandbox, 'cases.json');
  writeFileSync(file, JSON.stringify({ cases: cases.map(([path, expect]) => ({ path, expect })) }));
  return file;
}

const ALL_FOUR: [string, string][] = [
  ['src/billing/invoice.ts', 'refuse'],
  ['src/ledger/entry.ts', 'ask'],
  ['src/docs/guide.md', 'governs'],
  ['README.md', 'none'],
];

describe('mnema rules test', () => {
  it('passes a file every path meets, and exits 0', async () => {
    const done = await mnema('rules', 'test', declare(...ALL_FOUR));
    expect(done.failed).toBe(false);
    expect(done.out).toContain(`MATCH: src/billing/invoice.ts: refuse (${ids['src/billing']})`);
    expect(done.out).toContain('MATCH: README.md: none');
    expect(done.out).toContain('4 of 4 case(s) met their verdict.');
  });

  it('names each path that misses its verdict, with what it met, and exits 1', async () => {
    const done = await mnema(
      'rules',
      'test',
      declare(
        ['src/billing/invoice.ts', 'ask'],
        ['src/docs/guide.md', 'governs'],
        ['src/ledger/entry.ts', 'none'],
      ),
    );
    expect(done.failed).toBe(true);
    expect(done.out).toContain(
      `MISMATCH: src/billing/invoice.ts: expected ask, got refuse (${ids['src/billing']})`,
    );
    expect(done.out).toContain(
      `MISMATCH: src/ledger/entry.ts: expected none, got ask (${ids['src/ledger']})`,
    );
    expect(done.out).toContain('MATCH: src/docs/guide.md: governs');
    expect(done.out).toContain('1 of 3 case(s) met their verdict.');
  });

  it('catches a rule that stopped covering a path', async () => {
    const file = declare(['src/billing/invoice.ts', 'refuse']);
    expect((await mnema('rules', 'test', file)).failed).toBe(false);
    await mnema('unlink', ids['src/billing'] as string, 'src/billing', '--rel', 'refuses-a-write', '--reason', 'moved');
    const after = await mnema('rules', 'test', file);
    expect(after.failed).toBe(true);
    expect(after.out).toContain('MISMATCH: src/billing/invoice.ts: expected refuse, got none');
  });

  it('follows the gate: a refusal switched off is not met', async () => {
    await mnema('switch', 'off', 'edit-refuses-a-write');
    const done = await mnema('rules', 'test', declare(['src/billing/invoice.ts', 'refuse']));
    expect(done.failed).toBe(true);
    expect(done.out).toContain('MISMATCH: src/billing/invoice.ts: expected refuse, got none');
  });

  it('refuses a file with no case, an unknown verdict and a file that is not JSON', async () => {
    const empty = await mnema('rules', 'test', declare());
    expect(empty.failed).toBe(true);
    expect(empty.err).toContain('needs a non-empty "cases" list');
    const odd = await mnema('rules', 'test', declare(['a.ts', 'forbid']));
    expect(odd.failed).toBe(true);
    expect(odd.err).toContain('expects "forbid"; it takes one of refuse, ask, governs, none');
    writeFileSync(join(sandbox, 'bad.json'), '{ nope');
    const bad = await mnema('rules', 'test', join(sandbox, 'bad.json'));
    expect(bad.failed).toBe(true);
    expect(bad.err).toContain('cannot be read as JSON');
  });

  it('still answers a path named like the verb as the path it is', async () => {
    const done = await mnema('rules', 'src/billing/invoice.ts');
    expect(done.out).toContain(ids['src/billing']);
  });
});
