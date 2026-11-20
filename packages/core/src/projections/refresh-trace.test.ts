/**
 * A cache says, to whoever listens, how each refresh went: caught up from what arrived, found
 * nothing new, or replayed the whole record, and in that case WHICH branch sent it there and which
 * fingerprint or mark it did not find as it had recorded it.
 *
 * Each case is read off a real file in a real tree, opened by a second cache the way a second process opens it.
 */

import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  catalogUpcasters,
  decisionTransitioned,
  openChainForWriting,
  projectionCachePath,
  tailDir,
} from '@mnema/chain';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDatabase } from '../db/sqlite.js';
import { captureMemory } from '../knowledge/operations.js';
import { recordDecision } from '../workflow/decision-operations.js';
import { createTask, type WriteContext } from '../workflow/operations.js';
import { ProjectionCache } from './cache.js';
import { productStamp } from './cache-meta.js';
import { observeRefreshes, type RefreshReport } from './refresh-trace.js';

const upcasters = catalogUpcasters();

let root: string;
let keys: string;
const open: ProjectionCache[] = [];
let heard: RefreshReport[];

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'mnema-refresh-trace-'));
  keys = mkdtempSync(join(tmpdir(), 'mnema-refresh-trace-keys-'));
  heard = [];
  observeRefreshes((report) => heard.push(report));
});

afterEach(() => {
  observeRefreshes(undefined);
  for (const cache of open.splice(0)) cache.close();
  rmSync(root, { recursive: true, force: true });
  rmSync(keys, { recursive: true, force: true });
});

function writing(maxSegmentBytes?: number): WriteContext {
  return {
    writer: openChainForWriting(root, {
      keyRoot: keys,
      ...(maxSegmentBytes !== undefined ? { maxSegmentBytes } : {}),
    }),
    layout: { root },
    upcasters,
  };
}

function landed<T extends { ok: boolean }>(result: T): Extract<T, { ok: true }> {
  if (!result.ok) throw new Error(`setup refused: ${JSON.stringify(result)}`);
  return result as Extract<T, { ok: true }>;
}

function persisted(): ProjectionCache {
  const cache = ProjectionCache.open(root, { upcasters, persist: true });
  open.push(cache);
  return cache;
}

/** A warm file over a record, closed, with what it said while warming forgotten. */
function aWarmFile(maxSegmentBytes?: number): { ctx: WriteContext; task: string } {
  const ctx = writing(maxSegmentBytes);
  const task = landed(createTask(ctx, { title: 'a task that was already here' })).id;
  for (let each = 0; each < 6; each += 1) {
    landed(captureMemory(ctx, { content: `a memory already here, number ${each}` }));
  }
  ctx.writer.checkpoint();
  const warm = persisted();
  warm.refresh();
  warm.close();
  heard = [];
  return { ctx, task };
}

/** A second process opening the file and refreshing it: what the writes before it said is forgotten. */
function afresh(): void {
  heard = [];
  persisted().refresh();
}

function theLast(): RefreshReport {
  const report = heard.at(-1);
  if (report === undefined) throw new Error('nothing was reported');
  return report;
}

describe('a refresh is reported with the branch that decided it', () => {
  it('a chain that only grew is caught up, and the report counts what arrived', () => {
    const { ctx } = aWarmFile();
    landed(captureMemory(ctx, { content: 'arrived between two reads' }));
    ctx.writer.checkpoint();
    afresh();
    expect(heard).toEqual([{ root, outcome: 'incremental', arrived: 1 }]);
  });

  it('a chain that did not move is reported as unchanged', () => {
    aWarmFile();
    afresh();
    expect(heard).toEqual([{ root, outcome: 'unchanged' }]);
  });

  it('a cache in memory replays on its first reading and says it had nothing kept', () => {
    const ctx = writing();
    landed(captureMemory(ctx, { content: 'a memory' }));
    ctx.writer.checkpoint();
    const cache = ProjectionCache.open(root, { upcasters });
    open.push(cache);
    heard = [];
    cache.refresh();
    expect(heard).toEqual([{ root, outcome: 'replayed', branch: 'first-read' }]);
  });

  it('a file that holds no account of itself is replayed as one with no meta', () => {
    const ctx = writing();
    landed(captureMemory(ctx, { content: 'a memory' }));
    ctx.writer.checkpoint();
    afresh();
    expect(heard).toEqual([{ root, outcome: 'replayed', branch: 'no-cache-meta' }]);
  });

  it('a file written by other code names both stamps', () => {
    aWarmFile();
    const db = openDatabase(projectionCachePath({ root }));
    db.prepare("UPDATE cache_meta SET value = 'another-product' WHERE key = 'stamp'").run();
    db.close();
    afresh();
    expect(heard).toEqual([
      {
        root,
        outcome: 'replayed',
        branch: 'stamp',
        expected: 'another-product',
        found: productStamp(),
      },
    ]);
  });

  it('a sealed segment that is not the file recorded names the path, what was recorded and what is there', () => {
    const { ctx } = aWarmFile(2048);
    const dir = tailDir({ root }, ctx.writer.tail);
    const sealed = readdirSync(dir)
      .filter((name) => /^\d{6}\.jsonl$/.test(name))
      .sort()[0] as string;
    const file = join(dir, sealed);
    const before = statSync(file);
    utimesSync(file, new Date(before.atimeMs + 5_000), new Date(before.mtimeMs + 5_000));
    afresh();
    const report = theLast();
    expect(report).toMatchObject({ outcome: 'replayed', branch: 'sealed-segment', path: file });
    expect(report).toMatchObject({
      expected: `${before.size}:${before.mtimeMs}`,
      found: `${before.size}:${statSync(file).mtimeMs}`,
    });
  });

  it('a live segment edited below what was read names the path and the two digests', () => {
    const { ctx } = aWarmFile();
    const file = join(tailDir({ root }, ctx.writer.tail), '000001.jsonl');
    const held = readFileSync(file);
    const at = held.indexOf('a task');
    writeFileSync(file, Buffer.concat([held.subarray(0, at), Buffer.from('X'), held.subarray(at)]));
    afresh();
    const report = theLast();
    expect(report).toMatchObject({ outcome: 'replayed', branch: 'active-segment', path: file });
    if (report.outcome !== 'replayed') throw new Error('not a replay');
    expect(report.expected).toMatch(/sha256 [0-9a-f]{64} of the first \d+ bytes/);
    expect(report.found).toMatch(/sha256 [0-9a-f]{64} of the first \d+ bytes/);
    expect(report.found).not.toBe(report.expected);
  });

  it('a fact stamped before what is covered is not a suffix', () => {
    aWarmFile();
    const colleague = mkdtempSync(join(tmpdir(), 'mnema-refresh-trace-older-'));
    try {
      const older: WriteContext = {
        writer: openChainForWriting(root, { keyRoot: colleague }),
        layout: { root },
        upcasters,
        clock: () => '2000-01-01T00:00:00.000Z',
      };
      landed(captureMemory(older, { content: 'written long before, on another machine' }));
      older.writer.checkpoint();
      afresh();
      expect(heard).toEqual([{ root, outcome: 'replayed', branch: 'not-a-suffix' }]);
    } finally {
      rmSync(colleague, { recursive: true, force: true });
    }
  });

  it('a move the held state cannot judge alone is judged whole', () => {
    const ctx = writing();
    const decision = landed(recordDecision(ctx, { title: 'a decision', rationale: 'because' })).id;
    ctx.writer.checkpoint();
    const warm = persisted();
    warm.refresh();
    warm.close();
    heard = [];
    ctx.writer.append(
      decisionTransitioned(
        {
          at: new Date(Date.now() + 5_000).toISOString(),
          who: ctx.writer.anchor,
          signerFp: ctx.writer.signerFingerprint,
          subject: decision,
        },
        { from: 'rejected', to: 'accepted', action: 'accept', fields: { note: 'by hand' } },
      ),
    );
    ctx.writer.checkpoint();
    afresh();
    expect(heard).toEqual([{ root, outcome: 'replayed', branch: 'judge-it-whole' }]);
  });

  it('nothing is built, and nothing is said, when no one listens', () => {
    const { ctx } = aWarmFile();
    observeRefreshes(undefined);
    landed(captureMemory(ctx, { content: 'arrived' }));
    ctx.writer.checkpoint();
    afresh();
    expect(heard).toEqual([]);
  });
});

