// @plants-damage
/**
 * Which tail a write goes on with when the one its hint names does not go on here, on the files
 * alone: one of the tails of the key whose end is where this machine left it, when it is one this
 * worktree wrote or its end is on the base branch (ADR-446) and no other worktree names it; else a
 * new tail, with the reason. Each case is a pair of checkouts of one record, as two worktrees are:
 * their own `tails/` and hint, the notes and the lock shared.
 */

import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { taskCreated } from '../events/build.js';
import { openChainForWriting } from './chain.js';
import { keepWrittenHead } from './kept-head.js';
import { keyToSignWith } from './keystore.js';
import { installationIdPath, tailLockPath } from './layout.js';
import { inflightNames, markInflight } from './pool.js';
import { type ChainWriter, describeNewTail, type NewTail } from './writer.js';

let sandbox: string;
let shared: { root: string };

interface Checkout {
  readonly record: string;
  readonly place: string;
}

const checkout = (name: string): Checkout => ({
  record: join(sandbox, name, 'record'),
  place: join(sandbox, name, 'git'),
});

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'mnema-pool-'));
  shared = { root: join(sandbox, 'common') };
});

afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

interface Told {
  readonly sentences: NewTail[];
}

function open(
  at: Checkout,
  how: {
    reserved?: ReadonlySet<string>;
    onBase?: (tail: string, segment: string, hash: string) => boolean;
    told?: Told;
  } = {},
): ChainWriter {
  return openChainForWriting(at.record, {
    keyRoot: join(sandbox, 'identity'),
    sharedRoot: shared.root,
    installationRoot: at.place,
    pool: {
      checkoutRoot: at.place,
      reservedBy: () => how.reserved ?? new Set(),
      onBase: how.onBase ?? (() => false),
    },
    onNewTail: (opened) => how.told?.sentences.push(opened),
  });
}

function write(writer: ChainWriter, title: string): void {
  writer.append(
    taskCreated(
      {
        at: '2026-10-07T10:00:00.000Z',
        who: writer.anchor,
        signerFp: writer.signerFingerprint,
        subject: `${title}-${Math.random()}`,
      },
      { title },
    ),
  );
}

const tailsOf = (at: Checkout): string[] =>
  existsSync(join(at.record, 'tails')) ? readdirSync(join(at.record, 'tails')).sort() : [];

/** The second worktree's checkout of what the first holds: the same tails, as a merge or a clone gives. */
function copyOf(from: Checkout, name: string): Checkout {
  const to = checkout(name);
  cpSync(from.record, to.record, { recursive: true });
  return to;
}

/** One tail written in a checkout of its own, so the record holds it and the notes name it. */
function aTailWrittenIn(name: string): { at: Checkout; tail: string } {
  const at = checkout(name);
  const writer = open(at);
  write(writer, name);
  return { at, tail: writer.tail };
}

const idOf = (tail: string): string => tail.slice(tail.indexOf('-') + 1);

describe('the tail a write goes on with', () => {
  it('goes on with a tail of the key that ends here where this machine left it and is on the base branch, and takes it as its hint', () => {
    const first = aTailWrittenIn('one');
    const second = copyOf(first.at, 'two');
    const writer = open(second, { onBase: (tail) => tail === first.tail });
    write(writer, 'next');

    expect(writer.tail).toBe(first.tail);
    expect(tailsOf(second)).toEqual([first.tail]);
    const fingerprint = first.tail.split('-')[0] as string;
    expect(readFileSync(installationIdPath({ root: second.place }, fingerprint), 'utf-8')).toBe(
      `${idOf(first.tail)}\n`,
    );
  });

  it('founds a tail when the end of the one it could go on with is not on the base branch, and says no tail ends here', () => {
    const first = aTailWrittenIn('one');
    const second = copyOf(first.at, 'two');
    const told: Told = { sentences: [] };
    const writer = open(second, { onBase: () => false, told });
    write(writer, 'next');

    expect(writer.tail).not.toBe(first.tail);
    expect(tailsOf(second)).toHaveLength(2);
    expect(told.sentences).toHaveLength(1);
    expect(told.sentences[0]?.founded).toEqual({ why: 'none-ends-here', known: 1 });
    expect(describeNewTail(told.sentences[0] as NewTail)).toContain(
      'none of the 1 tail(s) this key already writes in this record can go on from here',
    );
  });

  it('goes on with a tail this worktree wrote itself, whatever the base branch holds', () => {
    const first = aTailWrittenIn('one');
    // The worktree lost its hint (a clean of what git ignores took the one in a checkout; here, removed).
    const fingerprint = first.tail.split('-')[0] as string;
    rmSync(installationIdPath({ root: first.at.place }, fingerprint));
    const writer = open(first.at, { onBase: () => false });
    write(writer, 'next');

    expect(writer.tail).toBe(first.tail);
    expect(tailsOf(first.at)).toEqual([first.tail]);
  });

  it('leaves a tail that another worktree names as its hint, and says that is why it founded one', () => {
    const first = aTailWrittenIn('one');
    const second = copyOf(first.at, 'two');
    const told: Told = { sentences: [] };
    const writer = open(second, {
      onBase: () => true,
      reserved: new Set([idOf(first.tail)]),
      told,
    });
    write(writer, 'next');

    expect(writer.tail).not.toBe(first.tail);
    expect(told.sentences[0]?.founded?.why).toBe('reserved');
  });

  it('says there is no note when no tail of the key was written by this machine here, and goes on silently the next time', () => {
    const first = aTailWrittenIn('one');
    const second = copyOf(first.at, 'two');
    rmSync(join(shared.root, 'locks'), { recursive: true });
    const told: Told = { sentences: [] };
    const writer = open(second, { onBase: () => true, told });
    write(writer, 'next');
    expect(told.sentences[0]?.founded).toEqual({ why: 'no-note', known: 1 });
    expect(describeNewTail(told.sentences[0] as NewTail)).toContain(
      'this repository holds no note of this machine writing any of them',
    );

    const again = open(second, { onBase: () => true, told });
    write(again, 'more');
    expect(again.tail).toBe(writer.tail);
    expect(told.sentences).toHaveLength(1);
  });

  it('is not slowed to a founding by tails whose notes no longer match: twenty dead ones and a live one still go on with the live one', () => {
    const live = aTailWrittenIn('live');
    const at = checkout('walker');
    cpSync(live.at.record, at.record, { recursive: true });
    for (let i = 0; i < 20; i += 1) {
      const there = copyOf(live.at, `dead-${i}`);
      const writer = open(there);
      write(writer, `dead-${i}`);
      cpSync(join(there.record, 'tails', writer.tail), join(at.record, 'tails', writer.tail), {
        recursive: true,
      });
      // The note now names an end this checkout does not have: a tail some other branch moved.
      writeFileSync(join(shared.root, 'locks', `${writer.tail}.head`), `99 ${'0'.repeat(64)}\n`);
    }
    const asked: string[] = [];
    const writer = open(at, {
      onBase: (tail) => {
        asked.push(tail);
        return tail === live.tail;
      },
    });
    write(writer, 'next');

    expect(writer.tail).toBe(live.tail);
    expect(asked).toEqual([live.tail]);
  });

  it('asks the base branch about at most sixteen candidates in one write, and founds a tail past that', () => {
    const first = aTailWrittenIn('seed');
    const at = checkout('walker');
    cpSync(first.at.record, at.record, { recursive: true });
    for (let i = 0; i < 19; i += 1) {
      const there = copyOf(first.at, `other-${i}`);
      const writer = open(there);
      write(writer, `other-${i}`);
      cpSync(join(there.record, 'tails', writer.tail), join(at.record, 'tails', writer.tail), {
        recursive: true,
      });
    }
    let asked = 0;
    const writer = open(at, {
      onBase: () => {
        asked += 1;
        return false;
      },
    });
    write(writer, 'next');

    expect(asked).toBe(16);
    expect(tailsOf(at)).toHaveLength(21);
  });

  it('passes a candidate that another process is writing without waiting for it', () => {
    const first = aTailWrittenIn('one');
    const second = copyOf(first.at, 'two');
    mkdirSync(join(shared.root, 'locks'), { recursive: true });
    writeFileSync(tailLockPath(shared, first.tail), `${process.pid} ${Date.now()}\n`);
    const told: Told = { sentences: [] };
    const began = Date.now();
    const writer = open(second, { onBase: () => true, told });
    write(writer, 'next');

    expect(Date.now() - began).toBeLessThan(1_500);
    expect(writer.tail).not.toBe(first.tail);
    expect(told.sentences[0]?.founded?.why).toBe('busy');
  });
});

describe('a tail that two worktrees may both write', () => {
  it('is not appended to by a writer that held it while another worktree went on with it', () => {
    const first = aTailWrittenIn('one');
    const held = open(first.at);
    write(held, 'before');
    expect(held.tail).toBe(first.tail);
    const second = copyOf(first.at, 'two');
    const fingerprint = first.tail.split('-')[0] as string;
    mkdirSync(join(second.place, 'keys'), { recursive: true });
    writeFileSync(installationIdPath({ root: second.place }, fingerprint), `${idOf(first.tail)}\n`);
    const there = open(second);
    write(there, 'the other worktree goes on');
    expect(there.tail).toBe(first.tail);

    const segment = join(first.at.record, 'tails', first.tail, '000001.jsonl');
    const before = readFileSync(segment);
    write(held, 'after');
    // This checkout's files did not change, the note did: the second append goes to another tail.
    expect(held.tail).not.toBe(first.tail);
    expect(readFileSync(segment).equals(before)).toBe(true);
  });

  it('is not finished by a worktree whose mark does not name the entry an act that died was about to write', () => {
    const first = aTailWrittenIn('one');
    const second = copyOf(first.at, 'two');
    const fingerprint = first.tail.split('-')[0] as string;
    mkdirSync(join(second.place, 'keys'), { recursive: true });
    writeFileSync(installationIdPath({ root: second.place }, fingerprint), `${idOf(first.tail)}\n`);

    // An act began in the first checkout and died after its intent note: the note names an entry
    // that is on no disk but may be on the first one's.
    const segment = join(first.at.record, 'tails', first.tail, '000001.jsonl');
    const lines = readFileSync(segment, 'utf-8').trim().split('\n');
    const last = JSON.parse(lines.at(-1) as string) as { link: { seq: number; hash: string } };
    const next = { seq: last.link.seq + 1, hash: 'f'.repeat(64) };
    const key = keyToSignWith({ root: join(sandbox, 'identity') }).keyPair;
    keepWrittenHead(
      shared,
      first.tail,
      {
        seq: last.link.seq,
        hash: last.link.hash,
        prev: null,
        coveredThrough: -1,
        checkpoint: null,
        next,
      },
      key,
    );
    markInflight({ root: first.at.place }, first.tail, next);
    expect(inflightNames({ root: first.at.place }, first.tail, next)).toBe(true);
    expect(inflightNames({ root: second.place }, first.tail, next)).toBe(false);

    const elsewhere = open(second);
    write(elsewhere, 'next');
    expect(elsewhere.tail).not.toBe(first.tail);
    expect(readFileSync(join(second.record, 'tails', first.tail, '000001.jsonl'), 'utf-8')).toBe(
      lines.join('\n') + '\n',
    );
  });
});
