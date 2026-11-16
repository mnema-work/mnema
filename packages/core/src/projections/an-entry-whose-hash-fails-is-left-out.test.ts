/**
 * AN ENTRY WHOSE HASH DOES NOT HOLD IS READ, LEFT OUT OF WHAT IS SERVED, AND NAMED.
 *
 * Each case alters a line of a tail the way a person with a text editor can (a title swapped in
 * place, the stored hash and the links untouched) and asks the cache what it holds:
 *
 *   - a replay leaves the line out of every table and names it (tail, seq, file, line), every
 *     altered line and not the first;
 *   - the line after it is measured against the hash the altered line STORES, so an altered line
 *     is one fact and not one and a break;
 *   - a connection that was open before the alteration says it when asked what the chain holds
 *     now, and a refresh brings it into agreement without serving the line;
 *   - a cache kept on disk carries the fact, so the next open says it without reading again.
 */
// @plants-damage

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import {
  catalogUpcasters,
  ENTRY_HASH_MISMATCH,
  listTails,
  openChainForWriting,
  orderedSegments,
  verify,
} from '@mnema/chain';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTask, type WriteContext } from '../workflow/operations.js';
import { ProjectionCache } from './cache.js';

const upcasters = catalogUpcasters();
let root: string;
let keys: string;
const open: ProjectionCache[] = [];

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'mnema-altered-'));
  keys = mkdtempSync(join(tmpdir(), 'mnema-altered-keys-'));
});
afterEach(() => {
  for (const cache of open.splice(0)) cache.close();
  rmSync(root, { recursive: true, force: true });
  rmSync(keys, { recursive: true, force: true });
});

function writing(): WriteContext {
  return { writer: openChainForWriting(root, { keyRoot: keys }), layout: { root }, upcasters };
}

function task(ctx: WriteContext, title: string): void {
  const made = createTask(ctx, { title });
  if (!made.ok) throw new Error('setup refused');
}

function cacheOver(persist: boolean): ProjectionCache {
  const cache = ProjectionCache.open(root, { upcasters, persist });
  open.push(cache);
  return cache;
}

/** The live segment of the one tail. */
function segment(): string {
  const [tail] = listTails({ root });
  return orderedSegments({ root }, tail as string).at(-1) as string;
}

/** Swaps `from` for `to`, same size, in the live segment: the hash each line stores is left alone. */
function alter(from: string, to: string): void {
  expect(to.length).toBe(from.length);
  const file = segment();
  const held = readFileSync(file, 'utf-8');
  expect(held).toContain(from);
  writeFileSync(file, held.replace(from, to));
}

const titles = (cache: ProjectionCache): string[] => cache.listTasks().map((one) => one.title);

describe('a replay over a record with altered lines', () => {
  it('leaves each altered line out, names each, and says no break after it', () => {
    const ctx = writing();
    task(ctx, 'Use pnpm for the workspace');
    task(ctx, 'a task that is left alone');
    task(ctx, 'Use yarn for the workspace');
    task(ctx, 'a last task, after them');
    ctx.writer.checkpoint();
    alter('Use pnpm for', 'Use npm  for');
    alter('Use yarn for', 'Use bun  for');

    const cache = cacheOver(false);
    cache.refresh();

    expect(titles(cache).sort()).toEqual(['a last task, after them', 'a task that is left alone']);
    expect(cache.retained).toEqual([
      expect.objectContaining({ seq: 1, segment: basename(segment()), line: 2 }),
      expect.objectContaining({ seq: 5, segment: basename(segment()), line: 6 }),
    ]);
    // The line after an altered one chains to the hash the altered one stores: no second fact.
    expect(cache.linkBreaks).toEqual([]);
    // The text of the altered line is nowhere in what the fact says.
    expect(JSON.stringify(cache.retained)).not.toContain('npm');
  });
});

describe('a connection open before the alteration', () => {
  it('says an altered arrival when asked what the chain holds now, and a refresh does not serve it', () => {
    const ctx = writing();
    task(ctx, 'a task the connection has read');
    ctx.writer.checkpoint();
    const cache = cacheOver(false);
    cache.refresh();
    expect(cache.integrityAsOfNow().retained).toEqual([]);

    task(ctx, 'Use pnpm for the workspace');
    alter('Use pnpm for', 'Use npm  for');

    const now = cache.integrityAsOfNow();
    expect(now.retained).toEqual([expect.objectContaining({ seq: 3, line: 4 })]);
    expect(now.breaks).toEqual([]);

    cache.refresh();
    expect(titles(cache)).toEqual(['a task the connection has read']);
    expect(cache.retained).toEqual(now.retained);
  });
});

describe('a cache kept on disk', () => {
  it('carries the retained lines, so the next open says them with no replay', () => {
    const ctx = writing();
    task(ctx, 'Use pnpm for the workspace');
    task(ctx, 'a task that is left alone');
    ctx.writer.checkpoint();
    alter('Use pnpm for', 'Use npm  for');
    const first = cacheOver(true);
    first.refresh();
    expect(first.retained).toHaveLength(1);
    first.close();

    const second = cacheOver(true);
    second.refresh();
    expect(second.retained).toEqual(first.retained);
    expect(titles(second)).toEqual(['a task that is left alone']);
  });
});

describe('the words', () => {
  it('are the verdict’s: a read and `verify` say one sentence about one altered line', () => {
    const ctx = writing();
    task(ctx, 'Use pnpm for the workspace');
    ctx.writer.checkpoint();
    alter('Use pnpm for', 'Use npm  for');
    const said = verify(root, upcasters).issues.map((issue) => issue.detail);
    expect(said).toContain(ENTRY_HASH_MISMATCH);
  });
});
