// @plants-damage
/**
 * What the move of an earlier layout does, on the files alone: the notes of a key's tails go from the
 * record's own `locks/` to the shared place, the id to this checkout's hint, once, and nothing is
 * moved through a link, over a tail somebody holds, or after the mark says it was done.
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
import { taskCreated } from '../events/build.js';
import { openChainForWriting } from './chain.js';
import { IntentNotKeptError } from './kept-head.js';
import { installationIdPath, migratedMarkPath, tailLockPath } from './layout.js';
import { RecordLinkedError } from './linked-write.js';
import { migrateMachinery } from './migration.js';
import { TailBusyError } from './tail-lock.js';
import type { ChainWriter } from './writer.js';

const KEY = 'a'.repeat(64);
const ID = '1'.repeat(32);
const OTHER = '2'.repeat(32);
const TAIL = `${KEY}-${ID}`;
const SIBLING = `${KEY}-${OTHER}`;

let sandbox: string;
let places: Parameters<typeof migrateMachinery>[0];

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'mnema-migration-'));
  places = {
    chain: { root: join(sandbox, 'record') },
    shared: { root: join(sandbox, 'git', 'common') },
    checkout: { root: join(sandbox, 'git', 'own') },
    fingerprint: KEY,
  };
  mkdirSync(join(places.chain.root, 'locks'), { recursive: true });
  mkdirSync(join(places.chain.root, 'keys'), { recursive: true });
});

afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

const legacy = (name: string) => join(places.chain.root, 'locks', name);
const shared = (name: string) => join(places.shared.root, 'locks', name);
const put = (path: string, text: string) => {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, text);
};
const read = (path: string) => readFileSync(path, 'utf-8');

/** What an earlier mnema leaves for one tail: the id and its three notes. */
function anEarlierLayout(): void {
  put(installationIdPath(places.chain, KEY), `${ID}\n`);
  put(legacy(`${TAIL}.head`), '5 hash\n');
  put(legacy(`${TAIL}.head.sig`), 'signed\n');
  put(legacy(`${TAIL}.cited`), '{}\n');
}

describe('the move of an earlier layout', () => {
  it('moves the notes of the tail and its id, the id last of all, and marks that it is done', () => {
    anEarlierLayout();
    migrateMachinery(places);

    expect(read(shared(`${TAIL}.head`))).toBe('5 hash\n');
    expect(read(shared(`${TAIL}.head.sig`))).toBe('signed\n');
    expect(read(shared(`${TAIL}.cited`))).toBe('{}\n');
    expect(read(installationIdPath(places.checkout, KEY))).toBe(`${ID}\n`);
    expect(existsSync(installationIdPath(places.chain, KEY))).toBe(false);
    for (const note of ['head', 'head.sig', 'cited']) {
      expect(existsSync(legacy(`${TAIL}.${note}`))).toBe(false);
    }
    expect(existsSync(migratedMarkPath(places.checkout, KEY))).toBe(true);
  });

  it('moves the notes of the other tails of the key too, the ones a later write goes on with', () => {
    anEarlierLayout();
    put(legacy(`${SIBLING}.head`), '0 other\n');
    put(legacy(`${'b'.repeat(64)}-${ID}.head`), 'another key\n');
    migrateMachinery(places);

    expect(read(shared(`${SIBLING}.head`))).toBe('0 other\n');
    expect(existsSync(legacy(`${'b'.repeat(64)}-${ID}.head`))).toBe(true);
    expect(existsSync(shared(`${'b'.repeat(64)}-${ID}.head`))).toBe(false);
  });

  it('keeps the hint a checkout already has, and still takes the old id away', () => {
    anEarlierLayout();
    put(installationIdPath(places.checkout, KEY), `${OTHER}\n`);
    migrateMachinery(places);

    expect(read(installationIdPath(places.checkout, KEY))).toBe(`${OTHER}\n`);
    expect(existsSync(installationIdPath(places.chain, KEY))).toBe(false);
  });

  it('removes the old note where the shared place holds the same one, and keeps the one place', () => {
    anEarlierLayout();
    put(shared(`${TAIL}.head`), '5 hash\n');
    put(shared(`${TAIL}.head.sig`), 'signed\n');
    migrateMachinery(places);

    expect(read(shared(`${TAIL}.head`))).toBe('5 hash\n');
    expect(existsSync(legacy(`${TAIL}.head`))).toBe(false);
  });

  it('retires the tail where the two places say different things: neither note is left', () => {
    anEarlierLayout();
    put(shared(`${TAIL}.head`), '6 newer\n');
    put(shared(`${TAIL}.head.sig`), 'signed elsewhere\n');
    migrateMachinery(places);

    for (const note of ['head', 'head.sig']) {
      expect(existsSync(shared(`${TAIL}.${note}`))).toBe(false);
      expect(existsSync(legacy(`${TAIL}.${note}`))).toBe(false);
    }
  });

  it('is done once: what an earlier mnema writes again in the record afterwards is left where it is', () => {
    anEarlierLayout();
    migrateMachinery(places);
    put(installationIdPath(places.chain, KEY), `${OTHER}\n`);
    put(legacy(`${SIBLING}.head`), '0 other\n');
    migrateMachinery(places);

    expect(read(installationIdPath(places.chain, KEY))).toBe(`${OTHER}\n`);
    expect(read(legacy(`${SIBLING}.head`))).toBe('0 other\n');
    expect(existsSync(shared(`${SIBLING}.head`))).toBe(false);
  });

  it('marks a checkout that has nothing to move, so what appears later is never taken', () => {
    migrateMachinery(places);
    expect(existsSync(migratedMarkPath(places.checkout, KEY))).toBe(true);
  });

  it('leaves a tail somebody holds where it is, and moves the rest', () => {
    anEarlierLayout();
    put(legacy(`${SIBLING}.head`), '0 other\n');
    put(tailLockPath(places.chain, SIBLING), `${process.pid} ${Date.now()}\n`);
    migrateMachinery(places);

    expect(existsSync(legacy(`${SIBLING}.head`))).toBe(true);
    expect(read(shared(`${TAIL}.head`))).toBe('5 hash\n');
  });

  it('waits for the earlier lock of the tail in use, and refuses where it does not come free', () => {
    anEarlierLayout();
    put(tailLockPath(places.chain, TAIL), `${process.pid} ${Date.now()}\n`);
    expect(() => migrateMachinery(places)).toThrow(TailBusyError);
    expect(read(legacy(`${TAIL}.head`))).toBe('5 hash\n');
    expect(existsSync(migratedMarkPath(places.checkout, KEY))).toBe(false);
  }, 10_000);

  it('copies a note, synced and renamed, where the two places are on different file systems', () => {
    // A tmpfs beside the temporary directory is another file system on the runners that have one.
    if (!existsSync('/dev/shm')) return;
    const other = mkdtempSync(join('/dev/shm', 'mnema-migration-'));
    try {
      places = { ...places, shared: { root: join(other, 'common') } };
      anEarlierLayout();
      migrateMachinery(places);
      expect(read(shared(`${TAIL}.head`))).toBe('5 hash\n');
      expect(existsSync(legacy(`${TAIL}.head`))).toBe(false);
      expect(
        readdirSync(join(places.shared.root, 'locks')).filter((name) => /\.\d+$/.test(name)),
      ).toEqual([]);
    } finally {
      rmSync(other, { recursive: true, force: true });
    }
  });

  it('moves nothing through a note that is a link: it is refused by name, before the first byte', () => {
    anEarlierLayout();
    put(join(sandbox, 'outside'), 'untouched\n');
    rmSync(legacy(`${TAIL}.cited`));
    symlinkSync(join(sandbox, 'outside'), legacy(`${TAIL}.cited`));

    expect(() => migrateMachinery(places)).toThrow(RecordLinkedError);
    expect(read(legacy(`${TAIL}.head`))).toBe('5 hash\n');
    expect(existsSync(shared(`${TAIL}.head`))).toBe(false);
    expect(read(join(sandbox, 'outside'))).toBe('untouched\n');
  });
});

describe('a writer opened over a shared place', () => {
  const keyRoot = () => join(sandbox, 'identity');

  const open = (shared: boolean): ChainWriter =>
    openChainForWriting(places.chain.root, {
      keyRoot: keyRoot(),
      ...(shared ? { sharedRoot: places.shared.root, installationRoot: places.checkout.root } : {}),
    });

  const write = (writer: ChainWriter, title: string): void => {
    writer.append(
      taskCreated(
        {
          at: '2026-10-07T10:00:00.000Z',
          who: writer.anchor,
          signerFp: writer.signerFingerprint,
          subject: `${writer.tail}-${title}`,
        },
        { title },
      ),
    );
  };

  it('keeps its notes and its id there, goes on with the same tail when opened again, and none is in the record', () => {
    const first = open(true);
    write(first, 'one');
    const tail = first.tail;
    const notes = readdirSync(join(places.shared.root, 'locks'));
    expect(notes).toEqual(expect.arrayContaining([`${tail}.head`, `${tail}.head.sig`]));
    expect(existsSync(installationIdPath(places.checkout, first.signerFingerprint))).toBe(true);
    expect(existsSync(installationIdPath(places.chain, first.signerFingerprint))).toBe(false);
    expect(existsSync(legacy(`${tail}.head`))).toBe(false);

    const again = open(true);
    write(again, 'two');
    expect(again.tail).toBe(tail);
    expect(readdirSync(join(places.chain.root, 'tails'))).toEqual([tail]);
  });

  it('moves what a writer without the place kept in the record, and goes on with the same tail', () => {
    const earlier = open(false);
    write(earlier, 'one');
    const tail = earlier.tail;
    expect(existsSync(legacy(`${tail}.head`))).toBe(true);

    const now = open(true);
    write(now, 'two');
    expect(now.tail).toBe(tail);
    expect(existsSync(legacy(`${tail}.head`))).toBe(false);
    expect(existsSync(shared(`${tail}.head`))).toBe(true);
    expect(existsSync(migratedMarkPath(places.checkout, now.signerFingerprint))).toBe(true);
  });

  it('refuses an append whose intent note cannot be kept, before the line, and writes nothing', () => {
    const writer = open(true);
    write(writer, 'one');
    const tail = writer.tail;
    const segment = join(places.chain.root, 'tails', tail, '000001.jsonl');
    const before = readFileSync(segment);
    rmSync(shared(`${tail}.head.sig`));
    mkdirSync(shared(`${tail}.head.sig`));

    expect(() => write(writer, 'two')).toThrow(IntentNotKeptError);
    expect(readFileSync(segment).equals(before)).toBe(true);
    // Put right, the next append keeps it again, as a file.
    rmSync(shared(`${tail}.head.sig`), { recursive: true });
    write(writer, 'three');
    expect(statSync(shared(`${tail}.head.sig`)).isFile()).toBe(true);
  });
});
