/**
 * A PART OF THE RECORD THIS MNEMA DOES NOT READ IS LEFT OUT OF WHAT IS SERVED, AND NAMED (ADR-396, ADR-406).
 *
 * Each case damages a record the way a person or a merge can (a line overwritten, a line after the
 * last one, a segment replaced by a link) and asks the cache what it holds:
 *
 *   - a replay serves every line that reads, names the part (tail, file, line, why) and says the
 *     break the missing line leaves in its tail;
 *   - a connection that was open before the damage says it when asked what the chain holds now, and
 *     a refresh brings it into agreement without serving it;
 *   - a cache kept on disk carries the fact, so the next open says it without reading again;
 *   - a part that is mended is said no more by the cache that said it, whether the line was the last
 *     one or a link: the cache replays rather than believe what it read past.
 */
// @plants-damage

import {
  appendFileSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { catalogUpcasters, listTails, openChainForWriting, orderedSegments } from '@mnema/chain';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTask, type WriteContext } from '../workflow/operations.js';
import { ProjectionCache } from './cache.js';
import { orderedEvents } from './order.js';

const upcasters = catalogUpcasters();
let root: string;
let keys: string;
const open: ProjectionCache[] = [];

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'mnema-unread-'));
  keys = mkdtempSync(join(tmpdir(), 'mnema-unread-keys-'));
});
afterEach(() => {
  for (const cache of open.splice(0)) cache.close();
  rmSync(root, { recursive: true, force: true });
  rmSync(keys, { recursive: true, force: true });
});

function writing(): WriteContext {
  return { writer: openChainForWriting(root, { keyRoot: keys }), layout: { root }, upcasters };
}

/** One act, signed as the product signs each: a damaged line withholds only its own act's range. */
function task(ctx: WriteContext, title: string): void {
  const made = createTask(ctx, { title });
  if (!made.ok) throw new Error('setup refused');
  ctx.writer.checkpoint();
}

function cacheOver(persist: boolean): ProjectionCache {
  const cache = ProjectionCache.open(root, { upcasters, persist });
  open.push(cache);
  return cache;
}

const tailName = (): string => listTails({ root })[0] as string;
const segment = (): string => orderedSegments({ root }, tailName()).at(-1) as string;
const titles = (cache: ProjectionCache): string[] => cache.listTasks().map((one) => one.title);

/** Overwrites twelve bytes of the line that holds `text` with a merge's marker. */
function overwrite(text: string): void {
  const lines = readFileSync(segment(), 'utf-8').split('\n');
  const at = lines.findIndex((line) => line.includes(text));
  expect(at, `the line that holds ${text}`).toBeGreaterThan(-1);
  lines[at] = `<<<<<<< HEAD${(lines[at] as string).slice(12)}`;
  writeFileSync(segment(), lines.join('\n'));
}

describe('a replay over a record with a line that does not read', () => {
  it('serves the rest, names the line, and says the break it leaves', () => {
    const ctx = writing();
    task(ctx, 'a task before the damage');
    task(ctx, 'a task that is lost with its line');
    task(ctx, 'a task after the damage');
    ctx.writer.checkpoint();
    overwrite('lost with its line');

    const cache = cacheOver(false);
    cache.refresh();

    expect(titles(cache).sort()).toEqual(['a task after the damage', 'a task before the damage']);
    expect(cache.refused).toEqual([
      expect.objectContaining({ kind: 'line', tail: tailName(), line: expect.any(Number) }),
    ]);
    expect(cache.linkBreaks).toEqual([expect.objectContaining({ tail: tailName() })]);
    // The text of the line is in nothing the fact says beyond what the parser quoted of its start.
    expect(JSON.stringify(cache.refused)).not.toContain('lost with its line');
  });

  it('is served around by the events the identity folds stand on, and stops where it was asked to stop', () => {
    const ctx = writing();
    task(ctx, 'a task before the damage');
    task(ctx, 'a task that is lost with its line');
    ctx.writer.checkpoint();
    overwrite('lost with its line');
    expect(() => orderedEvents({ root }, upcasters)).toThrow();
    // Asked to serve around the line, the fold has the task before it and not the one it holds.
    const kinds = orderedEvents({ root }, upcasters, true).map((event) => event.kind);
    expect(kinds.filter((kind) => kind === 'task.created')).toHaveLength(1);
  });
});

describe('a connection open before the damage', () => {
  it('says a line after the last one when asked what the chain holds now, and drops it when it is mended', () => {
    const ctx = writing();
    task(ctx, 'a task the connection has read');
    ctx.writer.checkpoint();
    const cache = cacheOver(false);
    cache.refresh();
    expect(cache.integrityAsOfNow().refused).toEqual([]);

    const sound = readFileSync(segment());
    appendFileSync(segment(), 'a line nobody can read\n');
    expect(cache.integrityAsOfNow().refused).toEqual([
      expect.objectContaining({ kind: 'line', tail: tailName() }),
    ]);

    cache.refresh();
    expect(titles(cache)).toEqual(['a task the connection has read']);
    expect(cache.refused).toHaveLength(1);

    // Mended: the line is gone, and the cache that said it says it no more.
    writeFileSync(segment(), sound);
    cache.refresh();
    expect(cache.refused).toEqual([]);
  });

  it('says a segment that became a link, and no more once the segment is back', () => {
    const ctx = writing();
    task(ctx, 'a task the connection has read');
    ctx.writer.checkpoint();
    const cache = cacheOver(false);
    cache.refresh();
    expect(cache.refused).toEqual([]);

    const file = segment();
    const sound = readFileSync(file);
    const elsewhere = join(keys, 'elsewhere.jsonl');
    writeFileSync(elsewhere, sound);
    rmSync(file);
    symlinkSync(elsewhere, file);
    cache.refresh();
    expect(cache.refused).toEqual([
      expect.objectContaining({ kind: 'link', place: `tails/${tailName()}/000001.jsonl` }),
    ]);
    expect(titles(cache)).toEqual([]);

    rmSync(file);
    writeFileSync(file, sound);
    cache.refresh();
    expect(cache.refused).toEqual([]);
    expect(titles(cache)).toEqual(['a task the connection has read']);
  });
});

describe('a cache kept on disk', () => {
  it('carries the parts it left out, so the next open says them with no replay', () => {
    const ctx = writing();
    task(ctx, 'a task before the damage');
    task(ctx, 'a task that is lost with its line');
    task(ctx, 'a task after the damage');
    ctx.writer.checkpoint();
    overwrite('lost with its line');
    const first = cacheOver(true);
    first.refresh();
    expect(first.refused).toHaveLength(1);
    first.close();

    const second = cacheOver(true);
    second.refresh();
    expect(second.refused).toEqual(first.refused);
    expect(titles(second).sort()).toEqual(['a task after the damage', 'a task before the damage']);
  });
});
