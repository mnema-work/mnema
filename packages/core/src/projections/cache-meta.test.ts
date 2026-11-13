/**
 * What a cache says about itself (the stamp, the frontier and the fingerprints) and the one
 * thing each is for: telling a cache that can still be trusted from one that cannot.
 */

import { mkdtempSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ensureSchema } from '../db/schema.js';
import { IN_MEMORY, openDatabase } from '../db/sqlite.js';
import {
  activeMarks,
  activeSegmentsHold,
  type CacheMeta,
  keepActiveMarks,
  productStamp,
  readGeneration,
  readMeta,
  sealedFingerprints,
  sealedSegmentsHold,
  writeMeta,
} from './cache-meta.js';
import type { ChainFrontier, TailReach } from './order.js';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'mnema-meta-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function frontierOver(segments: readonly string[], bytes = 400): ChainFrontier {
  return {
    events: 12,
    unresolved: [],
    tails: new Map([
      [
        'a-tail',
        {
          lastSeq: 11,
          lastHash: 'h'.repeat(64),
          boundary: { segment: segments.at(-1) as string, bytes },
          segments,
          latestAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    ]),
  };
}

describe('the stamp', () => {
  it('is one value for the code that is running, and a digest of it', () => {
    expect(productStamp()).toBe(productStamp());
    expect(productStamp()).toMatch(/^[0-9a-f]{32}$/);
  });

  it('is the one the build wrote in, when it wrote one, without reading a file', async () => {
    vi.resetModules();
    vi.stubGlobal('MNEMA_PRODUCT_STAMP', 'written-by-the-bundle');
    try {
      const fresh = await import('./cache-meta.js');
      expect(fresh.productStamp()).toBe('written-by-the-bundle');
    } finally {
      vi.unstubAllGlobals();
      vi.resetModules();
    }
  });
});

describe('what is stored', () => {
  it('reads back exactly what was written, frontier included', () => {
    const db = openDatabase(IN_MEMORY);
    ensureSchema(db);
    expect(readMeta(db), 'a fresh database says nothing').toBeUndefined();
    expect(readGeneration(db)).toBe(-1);

    const meta: CacheMeta = {
      stamp: productStamp(),
      generation: 4,
      frontier: frontierOver(['/x/000001.jsonl']),
      breaks: [{ tail: 'a-tail', seq: 3, detail: 'seq gap: expected 3, found 4' }],
      unread: [{ kind: 'x.from-the-future', tail: 'a-tail', subject: 'a-subject' }],
      sealed: { '/x/000001.jsonl': '10:1' },
      active: { '/x/000002.jsonl': '10:1:10:abc' },
    };
    writeMeta(db, meta);
    expect(readMeta(db)).toEqual(meta);
    expect(readGeneration(db)).toBe(4);
    db.close();
  });
});

describe('the fingerprints of sealed segments', () => {
  it('cover every segment but the one a tail is still appending to', () => {
    const sealed = join(dir, '000001.jsonl');
    const live = join(dir, '000002.jsonl');
    writeFileSync(sealed, 'a\n');
    writeFileSync(live, 'b\n');
    const fingerprints = sealedFingerprints(frontierOver([sealed, live]));
    expect(Object.keys(fingerprints)).toEqual([sealed]);
  });

  it('hold while the file is the file, and stop holding when it is not', () => {
    const sealed = join(dir, '000001.jsonl');
    writeFileSync(sealed, 'the same bytes\n');
    const recorded = sealedFingerprints(frontierOver([sealed, join(dir, '000002.jsonl')]));
    expect(sealedSegmentsHold(recorded)).toBe(true);

    // The same size, a later modification time: a rewrite, which a sealed segment never is.
    const before = statSync(sealed);
    utimesSync(sealed, new Date(before.atimeMs + 5_000), new Date(before.mtimeMs + 5_000));
    expect(sealedSegmentsHold(recorded)).toBe(false);

    // And a file that is gone is not the file that was recorded.
    rmSync(sealed);
    expect(sealedSegmentsHold(recorded)).toBe(false);
  });
});

describe('the marks of active segments', () => {
  const bytes = 'one line\nanother line\n';

  /** What stat says of each file now, as an independent source of the stamp a reading is given first. */
  const stampsOf = (...files: string[]): Record<string, string> =>
    Object.fromEntries(
      files.map((file) => {
        const stat = statSync(file, { bigint: true });
        return [file, `${stat.size}:${stat.mtimeNs}`];
      }),
    );

  function later(file: string): void {
    const before = statSync(file);
    utimesSync(file, before.atime, new Date(before.mtimeMs + 5_000));
  }

  it('cover the segment a tail is appending to, and not one that a later segment sealed', () => {
    const sealed = join(dir, '000001.jsonl');
    const live = join(dir, '000002.jsonl');
    writeFileSync(sealed, bytes);
    writeFileSync(live, bytes);
    expect(
      Object.keys(activeMarks(frontierOver([sealed, live], bytes.length), stampsOf(sealed, live))),
    ).toEqual([live]);
    // The reading ended in a segment that has a later one beside it: that is sealed, not active.
    const over = frontierOver([live, join(dir, '000003.jsonl')], bytes.length);
    const reach = over.tails.get('a-tail') as TailReach;
    const endedInLive = {
      ...over,
      tails: new Map([['a-tail', { ...reach, boundary: { segment: live, bytes: bytes.length } }]]),
    };
    expect(activeMarks(endedInLive, stampsOf(live))).toEqual({});
  });

  it('hold while the segment has the size and the time it had, without reading it', () => {
    const live = join(dir, '000001.jsonl');
    writeFileSync(live, bytes);
    const recorded = activeMarks(frontierOver([live], bytes.length), stampsOf(live));
    expect(activeSegmentsHold(recorded)).toEqual(recorded);
  });

  it('hold when only the time moved or the segment grew past the frontier, and stop when what is below it changed', () => {
    const live = join(dir, '000001.jsonl');
    writeFileSync(live, bytes);
    const recorded = activeMarks(frontierOver([live], bytes.length), stampsOf(live));

    later(live);
    expect(activeSegmentsHold(recorded), 'a touch: the same bytes').toBeDefined();

    writeFileSync(live, `${bytes}a line that arrived\n`);
    expect(
      activeSegmentsHold(recorded),
      'an append: the same bytes below the frontier',
    ).toBeDefined();

    writeFileSync(live, bytes.replace('one', 'ONE'));
    later(live);
    expect(activeSegmentsHold(recorded), 'the same size, other bytes').toBeUndefined();

    writeFileSync(live, bytes.slice(0, 10));
    expect(activeSegmentsHold(recorded), 'shorter than the frontier').toBeUndefined();

    rmSync(live);
    expect(activeSegmentsHold(recorded), 'gone').toBeUndefined();
  });

  it('are not held by a mark that says the segment could not be read, or that is not a mark', () => {
    expect(activeSegmentsHold({ [join(dir, 'x.jsonl')]: 'unreadable' })).toBeUndefined();
    expect(activeSegmentsHold({ [join(dir, 'x.jsonl')]: '1:2' })).toBeUndefined();
    expect(activeSegmentsHold({})).toEqual({});
  });

  it('give back the mark of the new time when a touch left the bytes alone, so it is hashed once', () => {
    const live = join(dir, '000001.jsonl');
    writeFileSync(live, bytes);
    const recorded = activeMarks(frontierOver([live], bytes.length), stampsOf(live));
    later(live);
    const kept = activeSegmentsHold(recorded) as Record<string, string>;
    expect(kept[live]).not.toBe(recorded[live]);
    expect(kept[live]?.startsWith(`${stampsOf(live)[live]}:`)).toBe(true);
    // Held from the numbers alone now: the same answer, and the mark is its own.
    expect(activeSegmentsHold(kept)).toEqual(kept);
  });

  it('are `unreadable` when the file is not the one that was stamped before the reading', () => {
    const live = join(dir, '000001.jsonl');
    writeFileSync(live, bytes);
    const stamped = stampsOf(live);
    // A rewrite that lands after the stamp and before the marks: same size, later time.
    writeFileSync(live, bytes.replace('one', 'ONE'));
    later(live);
    const marks = activeMarks(frontierOver([live], bytes.length), stamped);
    expect(marks[live]).toBe('unreadable');
    expect(activeSegmentsHold(marks)).toBeUndefined();
    // And a segment nobody stamped is no segment this reading can vouch for.
    expect(activeMarks(frontierOver([live], bytes.length), {})[live]).toBe('unreadable');
  });
});

describe('keeping the active marks', () => {
  function aFileAt(generation: number): ReturnType<typeof openDatabase> {
    const db = openDatabase(IN_MEMORY);
    ensureSchema(db);
    writeMeta(db, {
      stamp: productStamp(),
      generation,
      frontier: frontierOver([]),
      breaks: [],
      unread: [],
      sealed: {},
      active: { '/x/000001.jsonl': 'old' },
    });
    return db;
  }
  const activeOf = (db: ReturnType<typeof openDatabase>): unknown => readMeta(db)?.active;

  it('writes while the file is at the generation the marks were checked against, and leaves it there', () => {
    const db = aFileAt(4);
    expect(keepActiveMarks(db, { '/x/000001.jsonl': 'new' }, 4)).toBe(true);
    expect(activeOf(db)).toEqual({ '/x/000001.jsonl': 'new' });
    expect(readGeneration(db)).toBe(4);
    db.close();
  });

  it('writes nothing to a file another process has advanced since', () => {
    const db = aFileAt(5);
    expect(keepActiveMarks(db, { '/x/000001.jsonl': 'new' }, 4)).toBe(false);
    expect(activeOf(db)).toEqual({ '/x/000001.jsonl': 'old' });
    db.close();
  });

  it('does not wait for a writer that holds the file, and puts the connection\u2019s wait back', () => {
    const dirOfFile = mkdtempSync(join(tmpdir(), 'mnema-keep-'));
    const file = join(dirOfFile, 'projection.db');
    try {
      const db = openDatabase(file);
      ensureSchema(db);
      writeMeta(db, {
        stamp: productStamp(),
        generation: 4,
        frontier: frontierOver([]),
        breaks: [],
        unread: [],
        sealed: {},
        active: {},
      });
      const holder = openDatabase(file);
      holder.exec('BEGIN IMMEDIATE');
      const started = performance.now();
      try {
        expect(keepActiveMarks(db, { a: 'b' }, 4)).toBe(false);
      } finally {
        holder.exec('ROLLBACK');
        holder.close();
      }
      expect(performance.now() - started).toBeLessThan(1_000);
      const waits = db.prepare('PRAGMA busy_timeout').get() as { timeout: number };
      expect(waits.timeout).toBe(5_000);
      db.close();
    } finally {
      rmSync(dirOfFile, { recursive: true, force: true });
    }
  });

  it('lets a failure that is not the file\u2019s being held go up', () => {
    // A database with no cache_meta at all: SQLite refuses, and not for a busy or read-only file.
    const db = openDatabase(IN_MEMORY);
    expect(() => keepActiveMarks(db, {}, 4)).toThrow(/cache_meta/);
    db.close();
  });
});
