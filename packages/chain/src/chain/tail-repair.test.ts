// @plants-damage
/**
 * `repairTail`: a line of a segment that does not read, or whose hash does not hold, is put back from
 * what a revision held, only when it proves itself and chains on both sides, and nothing else is
 * written (ADR-398, ADR-399). The binary's own cases are `a-line-is-repaired-from-git.test.ts`; these
 * are the function's, on a tail the writer made.
 */

import {
  existsSync,
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
import { canonicalStringify } from '../events/canonical.js';
import { catalogUpcasters } from '../events/registry.js';
import { openChainForWriting } from './chain.js';
import { citationIndexPath } from './citation-index.js';
import { entryHash, writtenAsStored } from './hash.js';
import { writtenHeadPath } from './kept-head.js';
import { tailLockPath } from './layout.js';
import { TailBusyError } from './tail-lock.js';
import { repairTail, type TailRepairInput } from './tail-repair.js';
import { ensureTree } from './tree.js';
import { verifyChain } from './verify.js';

let sandbox: string;
let root: string;
let tail: string;
let segment: string;
let committed: Buffer;
let committedCheckpoints: Buffer;
let keyRoot: string;

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'mnema-repair-unit-'));
  root = join(sandbox, '.mnema');
  keyRoot = join(sandbox, 'keys');
  ensureTree({ root });
  for (const content of ['first', 'second', 'third', 'fourth']) {
    const w = openChainForWriting(root, { keyRoot });
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
  committedCheckpoints = readFileSync(join(root, 'tails', tail, 'checkpoints.jsonl'));
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
    committedCheckpoints,
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

  /** The line `index` of the revision as another valid entry: the link changed and the hash taken over it again. */
  const forged = (
    index: number,
    change: { prev?: string | null; seq?: number; tail?: string; content?: string },
  ): string => {
    const line = JSON.parse(committed.toString('latin1').split('\n')[index] as string);
    if (change.content !== undefined) line.event.payload.content = change.content;
    const link = {
      tail: change.tail ?? line.link.tail,
      seq: change.seq ?? line.link.seq,
      prev: change.prev === undefined ? line.link.prev : change.prev,
    };
    const hash = entryHash({ event: writtenAsStored(line.event), ...link });
    return canonicalStringify({ event: line.event, link: { ...link, hash } });
  };
  const revisionWith = (index: number, line: string): Map<string, Buffer> => {
    const all = committed.toString('latin1').split('\n');
    all[index] = line;
    return new Map([['000001.jsonl', Buffer.from(all.join('\n'), 'latin1')]]);
  };
  const damage = (index: number): void => {
    const all = lines();
    all[index] = `\0${(all[index] as string).slice(1)}`;
    put(all);
  };

  it('refuses a sibling of a fork, the same tail, seq and prev with other content, by the line after it', () => {
    damage(2);
    const done = repair({ committed: revisionWith(2, forged(2, { content: 'a sibling' })) });
    expect(done).toEqual({
      ok: false,
      refusal: { reason: 'NOT_CHAINED', segment: '000001.jsonl', line: 3, side: 'after' },
    });
  });

  // The last line has nothing after it, so only the side before can refuse these.
  it.each([
    ['prev', { prev: 'f'.repeat(64) }],
    ['seq', { seq: 9 }],
    ['tail', { tail: `${'0'.repeat(64)}-${'1'.repeat(32)}` }],
  ])(
    'refuses a last line from the revision with the wrong %s, by the line before it',
    (_, change) => {
      const last = lines().length - 2;
      damage(last);
      const before = readFileSync(segment);
      const done = repair({ committed: revisionWith(last, forged(last, change)) });
      expect(done).toEqual({
        ok: false,
        refusal: { reason: 'NOT_CHAINED', segment: '000001.jsonl', line: last + 1, side: 'before' },
      });
      expect(readFileSync(segment).equals(before)).toBe(true);
    },
  );

  it('puts the staging in the place of the notes, sweeps what a dead process left, and drops the index first', () => {
    damage(1);
    const dead = join(root, 'locks', `${tail}.000001.jsonl.repair.2147483646`);
    const besideDead = join(root, 'tails', tail, '.000001.jsonl.repair.2147483646');
    writeFileSync(dead, 'x');
    writeFileSync(besideDead, 'x');
    const done = repair();
    expect(done.ok).toBe(true);
    expect(readdirSync(join(root, 'locks')).some((name) => name.includes('.repair.'))).toBe(false);
    expect(readdirSync(join(root, 'tails', tail)).some((name) => name.includes('.repair.'))).toBe(
      false,
    );
  });
});

/** An event of the tail, as a forger without the key handles it: plain JSON. */
interface Stored {
  event: { payload: { content?: string }; [key: string]: unknown };
  link: { tail: string; seq: number; prev: string | null; hash: string };
}

describe('repairTail, when the signed checkpoints do not hold: the whole tail', () => {
  const checkpointsFile = (): string => join(root, 'tails', tail, 'checkpoints.jsonl');
  const held = (): Stored[] =>
    readFileSync(segment, 'utf-8')
      .trimEnd()
      .split('\n')
      .map((line) => JSON.parse(line) as Stored);
  /** Writes the events back, every link from `from` on computed again: all a forger can do. */
  const rechained = (events: Stored[], from = 0): void => {
    for (let i = from; i < events.length; i += 1) {
      const one = events[i] as Stored;
      const prev = i === 0 ? null : (events[i - 1] as Stored).link.hash;
      const hash = entryHash({
        event: writtenAsStored(one.event as never),
        tail: one.link.tail,
        seq: one.link.seq,
        prev,
      });
      one.link = { ...one.link, prev, hash };
    }
    writeFileSync(segment, `${events.map((one) => canonicalStringify(one as never)).join('\n')}\n`);
  };
  const rewrite = (seq: number, content: string): void => {
    const events = held();
    (events[seq] as Stored).event.payload.content = content;
    rechained(events, seq);
  };
  /** More events written by the writer, each signed: honest work after the revision. */
  const writeMore = (...contents: string[]): void => {
    for (const content of contents) {
      const w = openChainForWriting(root, { keyRoot });
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
    }
  };
  // The fixture's identity is never enrolled, so `verify` names that of every event; anything else
  // it says is about the tail.
  const verified = (): boolean =>
    verifyChain({ root }, catalogUpcasters()).issues.every((issue) =>
      issue.detail.includes('is not a key enrolled'),
    );
  const copies = (): string[] =>
    readdirSync(join(root, 'locks')).filter((name) => name.endsWith('.before-repair'));

  it('puts back a tail whose events were rewritten and re-chained under its checkpoints, and keeps the forged one', () => {
    rewrite(1, 'FORGED');
    const forged = readFileSync(segment);
    expect(verified()).toBe(false);

    const done = repair();
    expect(done).toMatchObject({
      ok: true,
      repaired: [],
      whole: {
        segments: ['000001.jsonl'],
        lines: 3,
        checkpointLines: 0,
        removed: [{ from: 1, to: 1 }],
      },
      kept: [join(root, 'locks', `${tail}.000001.jsonl.1.before-repair`)],
    });
    expect(readFileSync(segment).equals(committed)).toBe(true);
    expect(readFileSync(checkpointsFile()).equals(committedCheckpoints)).toBe(true);
    expect(
      readFileSync(join(root, 'locks', `${tail}.000001.jsonl.1.before-repair`)).equals(forged),
    ).toBe(true);
    expect(verified()).toBe(true);
  });

  it('puts back the checkpoints a forger emptied after re-chaining, each file kept as it was', () => {
    rewrite(2, 'FORGED');
    writeFileSync(checkpointsFile(), '');
    const done = repair();
    expect(done).toMatchObject({ ok: true, whole: { checkpointLines: 4 } });
    expect(copies().sort()).toEqual([
      `${tail}.000001.jsonl.1.before-repair`,
      `${tail}.checkpoints.jsonl.1.before-repair`,
    ]);
    expect(
      readFileSync(join(root, 'locks', `${tail}.checkpoints.jsonl.1.before-repair`)).length,
    ).toBe(0);
    expect(readFileSync(segment).equals(committed)).toBe(true);
    expect(readFileSync(checkpointsFile()).equals(committedCheckpoints)).toBe(true);
    expect(verified()).toBe(true);
  });

  it('removes a forged event appended with a checkpoint of a key the record does not hold, with this machine’s note here', () => {
    expect(existsSync(writtenHeadPath({ root }, tail))).toBe(true);
    const events = held();
    const last = events[events.length - 1] as Stored;
    events.push({
      event: { ...last.event, payload: { content: 'FORGED' } },
      link: { ...last.link, seq: 4 },
    });
    rechained(events, 4);
    const cps = readFileSync(checkpointsFile(), 'utf-8').trimEnd().split('\n');
    const forgedCp = JSON.parse(cps[cps.length - 1] as string);
    forgedCp.fromSeq = 4;
    forgedCp.toSeq = 4;
    forgedCp.signerFp = 'ab'.repeat(32);
    writeFileSync(checkpointsFile(), `${[...cps, JSON.stringify(forgedCp)].join('\n')}\n`);

    const done = repair();
    expect(done).toMatchObject({
      ok: true,
      whole: { removed: [{ from: 4, to: 4 }], keptAbove: [] },
    });
    expect(readFileSync(segment).equals(committed)).toBe(true);
    expect(readFileSync(checkpointsFile()).equals(committedCheckpoints)).toBe(true);
    expect(verified()).toBe(true);
  });

  it('removes a forged event appended unsigned at the end, which no checkpoint and no note proves', () => {
    const events = held();
    const last = events[events.length - 1] as Stored;
    events.push({
      event: { ...last.event, payload: { content: 'FORGED' } },
      link: { ...last.link, seq: 4 },
    });
    rechained(events, 4);
    const done = repair();
    expect(done).toMatchObject({ ok: true, whole: { removed: [{ from: 4, to: 4 }] } });
    expect(readFileSync(segment).equals(committed)).toBe(true);
  });

  it.each([
    ['an early line deleted and the rest re-chained, the seqs kept', 'kept'],
    ['an early line deleted and the rest re-chained and renumbered', 'renumbered'],
    ['a signed line deleted and nothing else touched', 'gone'],
  ])('puts back %s', (_, how) => {
    const events = held();
    events.splice(1, 1);
    if (how === 'renumbered') for (const [i, one] of events.entries()) one.link.seq = i;
    if (how === 'gone') {
      writeFileSync(
        segment,
        `${events.map((one) => canonicalStringify(one as never)).join('\n')}\n`,
      );
    } else rechained(events, 1);
    expect(verified()).toBe(false);
    const done = repair();
    expect(done.ok).toBe(true);
    expect(readFileSync(segment).equals(committed)).toBe(true);
    expect(verified()).toBe(true);
  });

  it('refuses a revision that is itself forged, and writes nothing', () => {
    rewrite(1, 'FORGED');
    const forged = readFileSync(segment);
    const done = repair({ committed: new Map([['000001.jsonl', forged]]) });
    expect(done).toEqual({
      ok: false,
      whole: {
        reason: 'REVISION_DOES_NOT_HOLD',
        file: 'checkpoints.jsonl',
        line: 2,
        fault: 'content-root-mismatch',
      },
    });
    expect(readFileSync(segment).equals(forged)).toBe(true);
    expect(copies()).toEqual([]);
  });

  it('refuses a revision that holds no event of the tail', () => {
    rewrite(1, 'FORGED');
    const done = repair({ committed: new Map(), committedCheckpoints: new Uint8Array() });
    expect(done).toEqual({ ok: false, whole: { reason: 'NOT_IN_REVISION' } });
  });

  it('keeps the signed work after a revision behind the note, with the links a forger re-chained computed again', () => {
    writeMore('fifth', 'sixth');
    const whole = readFileSync(segment);
    const wholeCheckpoints = readFileSync(checkpointsFile());
    rewrite(0, 'FORGED');

    const done = repair();
    expect(done).toMatchObject({
      ok: true,
      whole: {
        keptAbove: [{ from: 4, to: 5 }],
        relinked: [{ from: 4, to: 5 }],
        removed: [{ from: 0, to: 0 }],
      },
    });
    expect(readFileSync(segment).equals(whole)).toBe(true);
    expect(readFileSync(checkpointsFile()).equals(wholeCheckpoints)).toBe(true);
    expect(verified()).toBe(true);
  });

  it('refuses a revision behind the note that the signed lines do not fill, and without the note removes what nothing proves', () => {
    writeMore('fifth', 'sixth');
    rewrite(5, 'FORGED');
    const forged = readFileSync(segment);
    expect(repair()).toEqual({ ok: false, whole: { reason: 'REVISION_BEHIND_THE_NOTE', seq: 5 } });
    expect(readFileSync(segment).equals(forged)).toBe(true);

    rmSync(writtenHeadPath({ root }, tail));
    const done = repair();
    expect(done).toMatchObject({
      ok: true,
      whole: { keptAbove: [{ from: 4, to: 4 }], removed: [{ from: 5, to: 5 }] },
    });
    expect(held().map((one) => one.link.seq)).toEqual([0, 1, 2, 3, 4]);
    expect(
      readFileSync(join(root, 'locks', `${tail}.000001.jsonl.1.before-repair`)).equals(forged),
    ).toBe(true);
    expect(verified()).toBe(true);
  });

  it.each([1, 2])(
    'writes the segments before the checkpoints, so a kill after file %i leaves what a second run finishes',
    (killedAfter) => {
      rewrite(2, 'FORGED');
      writeFileSync(checkpointsFile(), '');
      let written = 0;
      expect(() =>
        repair({
          afterEachFile: () => {
            written += 1;
            if (written === killedAfter) throw new Error('killed');
          },
        }),
      ).toThrow('killed');
      if (killedAfter === 1) {
        expect(readFileSync(segment).equals(committed)).toBe(true);
        expect(readFileSync(checkpointsFile()).length).toBe(0);
      }
      const done = repair({ now: 2 });
      expect(done.ok).toBe(true);
      expect(readFileSync(segment).equals(committed)).toBe(true);
      expect(readFileSync(checkpointsFile()).equals(committedCheckpoints)).toBe(true);
      expect(verified()).toBe(true);
    },
  );

  it('writes nothing on a tail whose checkpoints hold', () => {
    writeMore('fifth');
    expect(repair()).toEqual({ ok: true, repaired: [], kept: [] });
    expect(copies()).toEqual([]);
  });

  it('puts the lines back first, says the checkpoints still do not hold, and the next run puts the tail back', () => {
    const all = lines();
    all[1] = `\0${(all[1] as string).slice(1)}`;
    put(all);
    writeFileSync(checkpointsFile(), '');
    const first = repair();
    expect(first).toMatchObject({ ok: true, stillFails: true, repaired: [{ seq: 1 }] });
    expect(readFileSync(checkpointsFile()).length).toBe(0);
    const second = repair({ now: 2 });
    expect(second).toMatchObject({ ok: true, whole: { checkpointLines: 4 } });
    expect(verified()).toBe(true);
  });
});
