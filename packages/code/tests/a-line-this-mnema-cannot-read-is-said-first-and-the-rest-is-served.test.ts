/**
 * A LINE THIS MNEMA CANNOT READ IS SAID ON THE FIRST LINE OF EVERY READ, THE REST OF THE RECORD IS
 * SERVED, AND EVERY WRITE IS STILL REFUSED (ADR-396, ADR-394), warm, cold and with a session open
 * before the damage.
 *
 * Three damages to one line of a committed tail, each of a different size of trouble for a reader: a
 * merge's `<<<<<<< HEAD` over twelve bytes, twelve NUL bytes in their place, and the keys of the line
 * in another order (the line a formatter leaves, which is not the canonical text). Through the built
 * binary, each read (`status`, `show <id>`, `search`, `brief`, `rules <path>`, `why <path>`), asked
 * with its two streams in the order a person sees them, holds:
 *
 *   - the first line names the part, the tail and the way out (the public tree: update mnema, or
 *     `mnema tail repair <tail>`), and the exit is the one the read had (0);
 *   - the other lines of the record are served: the decision that sits before the damaged line is found;
 *   - warm, cold and with a session open the first line and the exit are the same.
 *
 * And the other half, which does not change: every write is refused with the line named and the way
 * out, the `switch off` included, the record byte for byte as it was, and the gate denies the write
 * it was asked about. The same line in the private and in the machine-global tree is served around and
 * said without naming `mnema tail repair`, which only the repository's tree has a history for.
 */
// @plants-damage

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveTrees } from '@mnema/core';
import { describe, expect, it } from 'vitest';
import {
  type Answered,
  inEveryCacheState,
  type Planted,
  type TheCase,
} from './support/every-cache-state.js';
import { MNEMA_CLI } from './support/the-cli.js';

/** The built binary with its two streams MERGED in the order they were written, in a bare HOME. */
const mnema = (planted: Planted, args: string[], input?: string) =>
  spawnSync('bash', ['-c', 'exec "$0" "$@" 2>&1', process.execPath, MNEMA_CLI, ...args], {
    cwd: planted.repo,
    encoding: 'utf-8',
    input,
    timeout: 60_000,
    env: { PATH: process.env.PATH ?? '', HOME: planted.home, GIT_CONFIG_NOSYSTEM: '1' },
  });

type Judged = Planted & { id: string };

function aRecord(dir: string): Judged {
  const planted = { repo: join(dir, 'repo'), home: join(dir, 'home') };
  for (const path of [planted.repo, planted.home]) mkdirSync(path, { recursive: true });
  expect(mnema(planted, ['init', '--yes', '--hosts', 'none']).status).toBe(0);
  const recorded = mnema(planted, ['decision', 'record', 'Use pnpm', 'Because the lockfile']);
  expect(recorded.status).toBe(0);
  const id = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/.exec(
    recorded.stdout,
  )?.[1] as string;
  expect(id).toBeDefined();
  expect(mnema(planted, ['memory', 'a memory left alone']).status).toBe(0);
  expect(mnema(planted, ['decision', 'record', 'Use biome', 'Because it lints']).status).toBe(0);
  return { ...planted, id };
}

const tailsOf = (root: string): string => join(root, 'tails');
const tailIn = (root: string): string => readdirSync(tailsOf(root))[0] as string;
const segmentIn = (root: string): string => join(tailsOf(root), tailIn(root), '000001.jsonl');
const publicRoot = (repo: string): string => join(repo, '.mnema');

/** The line a damage is done to: the one that records `Use biome`, which the rest does not cite. */
function theLine(bytes: Buffer): { lines: Buffer[]; at: number } {
  const lines: Buffer[] = [];
  let from = 0;
  for (let i = 0; i < bytes.length; i += 1) {
    if (bytes[i] === 0x0a) {
      lines.push(bytes.subarray(from, i));
      from = i + 1;
    }
  }
  if (from < bytes.length) lines.push(bytes.subarray(from));
  const at = lines.findIndex((line) => line.includes('Use biome'));
  expect(at, 'the line that records Use biome').toBeGreaterThan(-1);
  return { lines, at };
}

/** A damage: the bytes of the segment after it. Each is a line this reader refuses. */
const DAMAGES: readonly (readonly [string, (line: Buffer) => Buffer])[] = [
  ['a merge marker over twelve bytes', (line) => Buffer.concat([Buffer.from('<<<<<<< HEAD'), line.subarray(12)])],
  ['twelve NUL bytes in their place', (line) => Buffer.concat([Buffer.alloc(12), line.subarray(12)])],
  [
    'the keys in another order',
    (line) => {
      const parsed = JSON.parse(line.toString('utf-8')) as Record<string, unknown>;
      const reversed = Object.fromEntries(Object.entries(parsed).reverse());
      return Buffer.from(JSON.stringify(reversed));
    },
  ],
];

function damage(file: string, how: (line: Buffer) => Buffer): void {
  const { lines, at } = theLine(readFileSync(file));
  const after = lines.map((line, i) => (i === at ? how(line) : line));
  const damaged = Buffer.concat(after.flatMap((line) => [line, Buffer.from('\n')]));
  expect(damaged.equals(readFileSync(file)), 'the damage changes the segment').toBe(false);
  writeFileSync(file, damaged);
}

const ASKS = (planted: Judged): string[][] => [
  ['status'],
  ['show', planted.id],
  ['search', 'lockfile'],
  ['brief'],
  ['rules', 'src/x.ts'],
  ['why', 'src/x.ts'],
];

function damagingCase(how: (line: Buffer) => Buffer): TheCase<Judged> {
  return {
    found: aRecord,
    damage(planted) {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 40);
      damage(segmentIn(publicRoot(planted.repo)), how);
    },
    run: (planted, ctx): Answered => {
      const said = ASKS(planted).map((args) => {
        ctx.forget();
        return { args, ran: mnema(planted, args) };
      });
      return {
        // `show <id>` of the id that is served is found; the whole of what is asked exits as the read did.
        status: said.find((one) => one.ran.status !== 0)?.ran.status ?? 0,
        stdout: said.map((one) => `@@@ ${one.args[0]}\n${one.ran.stdout}`).join('\n'),
        stderr: '',
      };
    },
    normalize: (said, planted) =>
      said
        .split(planted.id)
        .join('<id>')
        .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, '<id>')
        .replace(/mnid:[0-9a-f]{8,64}/g, 'mnid:<identity>')
        .replace(/[0-9a-f]{64}-[0-9a-f]{32}/g, '<tail>')
        .replace(/\d{4}-\d\d-\d\dT[\d:.]+Z/g, '<time>'),
  };
}

const FIRST_LINE =
  /^issue \[T1\] public <tail>: a line that does not read \(tails\/<tail>\/000001\.jsonl line \d+\): .+; this part was not read\. Update mnema if a newer one wrote the line, or `mnema tail repair <tail>` puts it back from the repository’s history\.$/;

describe.each(DAMAGES)('a line damaged as %s, in every state of the cache', (_name, how) => {
  // @proves everything-a-read-serves-was-checked
  it('is the first line of every read, which exits 0 and serves the rest', () => {
    const seen = inEveryCacheState(damagingCase(how));
    for (const state of [seen.warm, seen.cold, seen.session]) {
      const sections = state.said.split(/^@@@ /m).filter((one) => one !== '');
      expect(
        sections.map((one) => one.split('\n')[0]),
        state.state,
      ).toEqual(['status', 'show', 'search', 'brief', 'rules', 'why']);
      for (const section of sections) {
        const [name, first] = section.split('\n');
        expect(first, `${state.state} ${name}`).toMatch(FIRST_LINE);
      }
      // What sits before the damaged line is served: the other decision is found by its words.
      const search = sections.find((one) => one.startsWith('search')) as string;
      expect(search, state.state).toContain('Use pnpm');
      expect(search, state.state).not.toContain('Use biome');
      expect(state.status, state.state).toBe(0);
    }
    expect(seen.warm.said).toBe(seen.cold.said);
    expect(seen.session.said).toBe(seen.cold.said);
  }, 240_000);
});

describe('a line this mnema cannot read, and a write', () => {
  const aDamaged = (dir: string, how: (line: Buffer) => Buffer): Judged => {
    const planted = aRecord(dir);
    damage(segmentIn(publicRoot(planted.repo)), how);
    return planted;
  };

  const everyFileBelow = (root: string): Record<string, string> => {
    const held: Record<string, string> = {};
    const walk = (at: string): void => {
      for (const name of readdirSync(at, { withFileTypes: true })) {
        const path = join(at, name.name);
        if (name.isDirectory()) walk(path);
        else held[path] = readFileSync(path, 'latin1');
      }
    };
    walk(root);
    return held;
  };

  it('is refused, the switch included, with the line named, the way out, and the record as it was', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mnema-unread-write-'));
    try {
      const planted = aDamaged(dir, DAMAGES[0]?.[1] as (line: Buffer) => Buffer);
      const before = everyFileBelow(tailsOf(publicRoot(planted.repo)));
      for (const args of [
        ['decision', 'record', 'Use bun', 'Because it is fast'],
        ['memory', 'another memory'],
        ['switch', 'off', 'brief-document', '--reason', 'x'],
      ]) {
        const refused = mnema(planted, args);
        expect(refused.status, args.join(' ')).not.toBe(0);
        expect(refused.stdout, args.join(' ')).toContain('holds a line this mnema cannot read');
        expect(refused.stdout, args.join(' ')).toContain('000001.jsonl line');
        expect(refused.stdout, args.join(' ')).toContain('mnema tail repair');
      }
      expect(everyFileBelow(tailsOf(publicRoot(planted.repo)))).toEqual(before);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 120_000);

  it('is denied at the gate, which says the way out, and the hook that opens a session is not silent', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mnema-unread-gate-'));
    try {
      const planted = aDamaged(dir, DAMAGES[0]?.[1] as (line: Buffer) => Buffer);
      const write = JSON.stringify({
        tool_name: 'Write',
        tool_input: { file_path: join(planted.repo, 'src', 'x.ts'), content: 'a' },
        session_id: 's1',
        cwd: planted.repo,
      });
      const gate = mnema(planted, ['before-a-write', '--host', 'cursor'], write);
      expect(gate.stdout).toContain('deny');
      expect(gate.stdout).toContain('cannot be read by this mnema');
      expect(gate.stdout).toContain('mnema tail repair');
      const hook = mnema(planted, ['brief', '--hook']);
      expect(hook.status).toBe(0);
      expect(hook.stdout.split('\n')[0]).toMatch(/^issue \[T1\] public /);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 120_000);

  it('tells a line a newer mnema wrote to update mnema, as the way out beside the repair', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mnema-unread-newer-'));
    try {
      const planted = aRecord(dir);
      const file = segmentIn(publicRoot(planted.repo));
      const { lines, at } = theLine(readFileSync(file));
      lines[at] = Buffer.from(lines[at]?.toString('utf-8').replace(/^\{/, '{"future":1,') as string);
      writeFileSync(file, Buffer.concat(lines.flatMap((line) => [line, Buffer.from('\n')])));
      const read = mnema(planted, ['status']);
      expect(read.status).toBe(0);
      expect(read.stdout.split('\n')[0]).toContain('Update mnema if a newer one wrote the line');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 120_000);
});

describe.each(['private', 'global'] as const)('a line this mnema cannot read in the %s tree', (scope) => {
  it('is served around and said without the repair, and a write is refused in the words it always used (ADR-429, ADR-408)', () => {
    const dir = mkdtempSync(join(tmpdir(), `mnema-unread-${scope}-`));
    try {
      const planted = aRecord(dir);
      expect(mnema(planted, ['memory', 'a keepable memory', '--scope', scope]).status).toBe(0);
      const trees = resolveTrees(planted.repo, { home: planted.home });
      const root = (scope === 'private' ? trees.projectPrivate : trees.global) as string;
      const file = segmentIn(root);
      const held = readFileSync(file);
      expect(held.toString('utf-8')).toContain('a keepable memory');
      const lines = held.toString('latin1').split('\n');
      const at = lines.findIndex((line) => line.includes('a keepable memory'));
      lines[at] = `<<<<<<< HEAD${(lines[at] as string).slice(12)}`;
      writeFileSync(file, lines.join('\n'), 'latin1');

      for (const args of [['status'], ['brief'], ['search', 'lockfile']]) {
        const read = mnema(planted, args);
        const first = read.stdout.split('\n')[0] as string;
        expect(first, args.join(' ')).toContain(`issue [T1] ${scope} `);
        expect(first, args.join(' ')).toContain('This record is not versioned');
        expect(first, args.join(' ')).not.toContain('tail repair');
        expect(read.status, args.join(' ')).toBe(0);
      }
      // The public decision is still found.
      expect(mnema(planted, ['search', 'lockfile']).stdout).toContain('Use pnpm');

      const refused = mnema(planted, ['memory', 'one more']);
      expect(refused.status).not.toBe(0);
      expect(refused.stdout).toContain('holds a line this mnema cannot read');
      expect(refused.stdout).toContain('This record is not versioned');
      expect(refused.stdout).not.toContain('tail repair');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 180_000);
});
