// @plants-damage
/**
 * `repairTail`: a line of a segment that does not read, or whose hash does not hold, is put back from
 * what a revision held, only when it proves itself and chains on both sides, and nothing else is
 * written (ADR-398, ADR-399). The binary's own cases are `a-line-is-repaired-from-git.test.ts`; these
 * are the function's, on a tail the writer made.
 */

import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { memoryCaptured } from '../events/build.js';
import { catalogUpcasters } from '../events/registry.js';
import { openChainForWriting } from './chain.js';
import { citationIndexPath } from './citation-index.js';
import { tailLockPath } from './layout.js';
import { TailBusyError } from './tail-lock.js';
import { repairTail, type TailRepairInput } from './tail-repair.js';
import { ensureTree } from './tree.js';

let sandbox: string;
let root: string;
let tail: string;
let segment: string;
let committed: Buffer;

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'mnema-repair-unit-'));
  root = join(sandbox, '.mnema');
  ensureTree({ root });
  for (const content of ['first', 'second', 'third', 'fourth']) {
    const w = openChainForWriting(root, { keyRoot: join(sandbox, 'keys') });
    w.append(
      memoryCaptured(
        {
          at: new Date().toISOString(),
          who: w.anchor,
          signerFp: w.signerFingerprint,
          subject: content,
        },
        { content },
      ),
    );
    w.checkpoint();
    tail = w.tail;
  }
  segment = join(root, 'tails', tail, '000001.jsonl');
  committed = readFileSync(segment);
});

afterEach(() => rmSync(sandbox, { recursive: true, force: true }));

const lines = (): string[] => readFileSync(segment, 'latin1').split('\n');
const put = (all: string[]): void => writeFileSync(segment, all.join('\n'), 'latin1');
const repair = (over: Partial<TailRepairInput> = {}) =>
  repairTail({
    layout: { root },
    shared: { root },
    tailId: tail,
    upcasters: catalogUpcasters(),
    committed: new Map([['000001.jsonl', committed]]),
    now: 1,
    ...over,
  });

describe('repairTail', () => {
  it('puts back a line with a NUL in it, keeps the segment as it was, and drops the citation index', () => {
    const all = lines();
    const line = all[1] as string;
    all[1] = `${line.slice(0, 40)}\0${line.slice(41)}`;
    put(all);
    const damaged = readFileSync(segment);
    writeFileSync(citationIndexPath({ root }, tail), 'stale');

    const done = repair();
    expect(done).toEqual({
      ok: true,
      repaired: [{ segment: '000001.jsonl', line: 2, seq: 1, was: 'unreadable' }],
      kept: [join(root, 'locks', `${tail}.000001.jsonl.1.before-repair`)],
    });
    expect(readFileSync(segment).equals(committed)).toBe(true);
    expect(
      readFileSync(join(root, 'locks', `${tail}.000001.jsonl.1.before-repair`)).equals(damaged),
    ).toBe(true);
    expect(readdirSync(join(root, 'locks')).includes(`${tail}.citations`)).toBe(false);
    expect(readdirSync(join(root, 'tails', tail)).sort()).toEqual([
      '000001.jsonl',
      'checkpoints.jsonl',
      'tailproof.json',
    ]);
  });

  it('puts back a line that reads and whose hash does not hold, whatever mode the file has', () => {
    const all = lines();
    all[2] = (all[2] as string).replace('third', 'THIRD');
    put(all);
    const mode = statSync(segment).mode & 0o777;
    const done = repair();
    expect(done.ok && done.repaired.map((one) => one.was)).toEqual(['altered']);
    expect(readFileSync(segment).equals(committed)).toBe(true);
    expect(statSync(segment).mode & 0o777).toBe(mode);
  });

  it('writes nothing, and says so, when no line is damaged', () => {
    expect(repair()).toEqual({ ok: true, repaired: [], kept: [] });
    expect(readFileSync(segment).equals(committed)).toBe(true);
  });

  it('leaves a last line a crash cut short, and mends the line before it', () => {
    const all = lines();
    all[1] = (all[1] as string).replace('second', 'SECOND');
    put(all);
    writeFileSync(segment, '{"event":{"at":', { flag: 'a' });
    const done = repair();
    expect(done.ok).toBe(true);
    expect(readFileSync(segment, 'latin1')).toBe(`${committed.toString('latin1')}{"event":{"at":`);
  });

  it('refuses a revision whose line does not chain: two lines swapped, each of them holding its hash', () => {
    const swapped = committed.toString('latin1').split('\n');
    [swapped[1], swapped[2]] = [swapped[2] as string, swapped[1] as string];
    const all = lines();
    all[1] = `\0${(all[1] as string).slice(1)}`;
    put(all);
    const before = readFileSync(segment);
    const done = repair({
      committed: new Map([['000001.jsonl', Buffer.from(swapped.join('\n'), 'latin1')]]),
    });
    expect(done).toEqual({
      ok: false,
      refusal: { reason: 'NOT_CHAINED', segment: '000001.jsonl', line: 2, side: 'before' },
    });
    expect(readFileSync(segment).equals(before)).toBe(true);
    expect(readdirSync(join(root, 'locks')).some((name) => name.endsWith('.before-repair'))).toBe(
      false,
    );
  });

  it('tells the same unreadable bytes in the revision from a repairable line: a newer mnema wrote it', () => {
    const all = lines();
    all[1] = (all[1] as string).replace(/^\{/, '{"future":1,');
    put(all);
    const same = readFileSync(segment);
    const done = repair({ committed: new Map([['000001.jsonl', same]]) });
    expect(done).toEqual({
      ok: false,
      refusal: { reason: 'NEWER_MNEMA', segment: '000001.jsonl', line: 2 },
    });
    expect(readFileSync(segment).equals(same)).toBe(true);
  });

  it('refuses a conflict marker, a revision without the file, and one without the line', () => {
    const all = lines();
    all.splice(1, 0, '=======');
    put(all);
    expect(repair()).toEqual({
      ok: false,
      refusal: { reason: 'CONFLICT_MARKS', segment: '000001.jsonl', line: 2 },
    });
    const damaged = lines();
    damaged.splice(1, 1);
    damaged[1] = `\0${(damaged[1] as string).slice(1)}`;
    put(damaged);
    expect(repair({ committed: new Map() })).toEqual({
      ok: false,
      refusal: { reason: 'NOT_IN_REVISION', segment: '000001.jsonl', line: 2 },
    });
  });

  it('is waited out or refused while another process holds the tail, and the lock is not left behind', () => {
    const all = lines();
    all[1] = (all[1] as string).replace('second', 'SECOND');
    put(all);
    const lock = tailLockPath({ root }, tail);
    mkdirSync(join(root, 'locks'), { recursive: true });
    writeFileSync(lock, `${process.pid} ${Date.now()}\n`);
    expect(() => repair()).toThrow(TailBusyError);
    rmSync(lock);
    expect(repair().ok).toBe(true);
    expect(readdirSync(join(root, 'locks')).includes(`${tail}.lock`)).toBe(false);
  });

  it('writes nothing through a link', () => {
    const all = lines();
    all[1] = (all[1] as string).replace('second', 'SECOND');
    put(all);
    const real = join(sandbox, 'elsewhere.jsonl');
    const damaged = readFileSync(segment);
    writeFileSync(real, damaged);
    rmSync(segment);
    symlinkSync(real, segment);
    expect(() => repair()).toThrow(/symbolic link/);
    expect(readFileSync(real).equals(damaged)).toBe(true);
  });
});
