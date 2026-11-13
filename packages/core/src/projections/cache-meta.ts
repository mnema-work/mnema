/**
 * What a projection cache says about itself, so that a cache that outlives the process that
 * built it can be told from one that cannot be trusted.
 *
 * A database that is only ever in memory needs none of this: the process that built it is the
 * process that reads it. A database on disk is read by a process that did not build it, and
 * the only safe question to ask of it is "is this still the chain's projection?", which this
 * module answers from three things, each of which a stale cache fails differently:
 *
 *   - THE STAMP. What produced the rows: the code that folds and stores them, the schema, and
 *     the version of every kind the chain upcasts to. A cache built by other code is not
 *     wrong about the chain, it is wrong about what THIS code would have written, and the
 *     only repair is to build it again. The stamp is a digest of the projection modules'
 *     own bytes, so a change to a fold invalidates every cache on the machine without
 *     anybody remembering to bump a number.
 *   - THE FRONTIER. How far into the chain the rows reach (per tail, the byte the reading
 *     stopped at and the hash it ended on), which is exactly what `chainArrivals` needs to
 *     say what arrived since, and to say that nothing describes it as a suffix.
 *   - THE FINGERPRINTS. What the frontier cannot see: the bytes BELOW it. A reading that
 *     resumes from a byte never reads what is before it, so a segment rewritten after the
 *     cache was built would be served in silence for as long as the cache lasted, where a
 *     replay reads every line and is told. A sealed segment is never written again, so its
 *     size and modification time are what a rewrite cannot keep; any difference sends the
 *     cache back to a full replay. The ACTIVE segment of a tail is still appended to, so its
 *     size and its modification time move legitimately and cannot say as much; what it records
 *     is its size, its modification time (to the nanosecond the filesystem keeps) and the
 *     sha256 of the bytes below the frontier. Opened, a segment with the size and the time it
 *     had is the segment it was, and costs two numbers. A segment with either one changed has
 *     the sha256 of the prefix computed again, once, and a prefix that hashes differently
 *     sends the cache back to a full replay. Nothing is hashed on a read that finds the
 *     segment as it was left, and no sealed segment is ever hashed.
 *
 * WHAT THE FINGERPRINTS DO NOT SEE, and the limit is a declared one. A rewrite that restores
 * the modification time on purpose, to the size the file had, is not seen: in a sealed segment
 * for the same reason, and in an active one because nothing but the two numbers is looked at
 * while they hold. Neither is a rewrite inside the resolution of the filesystem's clock (one
 * second on HFS+, two on FAT and exFAT, whatever a network filesystem reports) of the moment
 * the cache was written. Whoever restores the time on purpose can rewrite `projection.db` the
 * same way. The projection is not a tamper detector. Tampering is `verify`'s, which recomputes
 * every hash and checks every signature, and which never reads the projection.
 */

import { createHash } from 'node:crypto';
import { closeSync, openSync, readdirSync, readFileSync, readSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  type ChainLayout,
  LATEST_VERSION,
  type LinkBreak,
  listTails,
  orderedSegments,
  type UnreadLine,
  WORKFLOWS,
} from '@mnema/chain';
import type { SqliteDatabase } from '../db/sqlite.js';
import type { ChainFrontier, TailReach } from './order.js';

/** What is stored under the cache's own keys. */
export interface CacheMeta {
  /** What produced the rows ({@link productStamp}). */
  readonly stamp: string;
  /** Moves with every change to the rows, so a writer can tell that another process wrote. */
  readonly generation: number;
  /** How far into the chain the rows reach. */
  readonly frontier: ChainFrontier;
  /** The tails that did not chain, as of the reading that built or last advanced the rows. */
  readonly breaks: readonly LinkBreak[];
  /** The lines of a kind this binary does not know that the rows reach: read past, never applied. */
  readonly unread: readonly UnreadLine[];
  /** Size and modification time of every sealed segment the frontier covers, by path. */
  readonly sealed: Readonly<Record<string, string>>;
  /**
   * Size, modification time and the sha256 of the bytes below the frontier of the segment each
   * tail is still appending to, by path ({@link activeMarks}).
   */
  readonly active: Readonly<Record<string, string>>;
}

/**
 * The stamp, when the build wrote it in. A bundle folds this module and the files it would hash
 * into chunks of another folder, so there is nothing beside it to read: `the-cli-bundle.mjs`
 * computes the stamp the compiled package computes, from the same files, and replaces this name
 * with it. Anywhere else the name is not defined and the files are read.
 */
declare const MNEMA_PRODUCT_STAMP: string | undefined;

/** The directories whose code decides what a projection row contains, relative to this file. */
const CODE_THAT_DECIDES_THE_ROWS = ['.', '../db'] as const;

let stamp: string | undefined;

/**
 * A digest of everything that decides what a row of this cache contains, computed once per
 * process: the bytes of the projection and schema modules (compiled or source, whichever is
 * running), the version every kind of the catalog is read at, and the workflows a move is
 * judged by. Test files, type
 * declarations and source maps are not code that runs, and are left out so that building the
 * documentation of a module does not throw away a cache.
 */
export function productStamp(): string {
  if (stamp !== undefined) return stamp;
  if (typeof MNEMA_PRODUCT_STAMP === 'string') {
    stamp = MNEMA_PRODUCT_STAMP;
    return stamp;
  }
  const here = dirname(fileURLToPath(import.meta.url));
  const hash = createHash('sha256');
  for (const relative of CODE_THAT_DECIDES_THE_ROWS) {
    const directory = join(here, relative);
    for (const name of readdirSync(directory).sort()) {
      if (!/\.(?:js|ts)$/.test(name) || /\.test\.|\.d\.ts$/.test(name)) continue;
      hash.update(`${relative}/${name}\0`);
      hash.update(readFileSync(join(directory, name)));
      hash.update('\0');
    }
  }
  hash.update(JSON.stringify(LATEST_VERSION));
  // The workflows decide which moves a row applies (FORMAT.md §6.7), and they live in the chain
  // package, outside the directories above: a table changed there is a cache built by other code.
  hash.update(JSON.stringify(WORKFLOWS));
  stamp = hash.digest('hex').slice(0, 32);
  return stamp;
}

/** Reads what the cache says about itself, or undefined when it says nothing (a fresh file). */
export function readMeta(db: SqliteDatabase): CacheMeta | undefined {
  const rows = db.prepare('SELECT key, value FROM cache_meta').all() as {
    key: string;
    value: string;
  }[];
  if (rows.length === 0) return undefined;
  const byKey = new Map(rows.map((row) => [row.key, row.value]));
  const stampHere = byKey.get('stamp');
  const generation = byKey.get('generation');
  const frontier = byKey.get('frontier');
  const breaks = byKey.get('breaks');
  const unread = byKey.get('unread');
  const sealed = byKey.get('sealed');
  const active = byKey.get('active');
  if (
    stampHere === undefined ||
    generation === undefined ||
    frontier === undefined ||
    breaks === undefined ||
    unread === undefined ||
    sealed === undefined ||
    active === undefined
  ) {
    return undefined;
  }
  return {
    stamp: stampHere,
    generation: Number(generation),
    frontier: decodeFrontier(frontier),
    breaks: JSON.parse(breaks) as LinkBreak[],
    unread: JSON.parse(unread) as UnreadLine[],
    sealed: JSON.parse(sealed) as Record<string, string>,
    active: JSON.parse(active) as Record<string, string>,
  };
}

/** The counter alone: what a writer asks, inside its transaction, before it writes. */
export function readGeneration(db: SqliteDatabase): number {
  const row = db.prepare("SELECT value FROM cache_meta WHERE key = 'generation'").get() as
    | { value: string }
    | undefined;
  return row === undefined ? -1 : Number(row.value);
}

/** Stores what the cache says about itself, all at once. */
export function writeMeta(db: SqliteDatabase, meta: CacheMeta): void {
  const put = db.prepare('INSERT OR REPLACE INTO cache_meta (key, value) VALUES (?, ?)');
  put.run('stamp', meta.stamp);
  put.run('generation', String(meta.generation));
  put.run('frontier', encodeFrontier(meta.frontier));
  put.run('breaks', JSON.stringify(meta.breaks));
  put.run('unread', JSON.stringify(meta.unread));
  put.run('sealed', JSON.stringify(meta.sealed));
  put.run('active', JSON.stringify(meta.active));
}

function encodeFrontier(frontier: ChainFrontier): string {
  return JSON.stringify({
    events: frontier.events,
    tails: [...frontier.tails],
    unresolved: frontier.unresolved,
  });
}

function decodeFrontier(stored: string): ChainFrontier {
  const parsed = JSON.parse(stored) as {
    events: number;
    tails: [string, TailReach][];
    unresolved?: string[];
  };
  return {
    events: parsed.events,
    tails: new Map(parsed.tails),
    unresolved: parsed.unresolved ?? [],
  };
}

/**
 * The fingerprint of every SEALED segment the frontier covers (every segment of a tail but
 * the one it was last appending to) as `<size>:<mtimeMs>`, by path.
 *
 * A segment that cannot be stat'ed is recorded as such rather than skipped, so that it is
 * a difference the day it can.
 */
export function sealedFingerprints(frontier: ChainFrontier): Readonly<Record<string, string>> {
  const fingerprints: Record<string, string> = {};
  for (const reach of frontier.tails.values()) {
    for (const segment of reach.segments.slice(0, -1))
      fingerprints[segment] = fingerprintOf(segment);
  }
  return fingerprints;
}

/** Whether every sealed segment a cache recorded is still the file it recorded. */
export function sealedSegmentsHold(recorded: Readonly<Record<string, string>>): boolean {
  for (const [segment, fingerprint] of Object.entries(recorded)) {
    if (fingerprintOf(segment) !== fingerprint) return false;
  }
  return true;
}

/** `<size>:<mtimeMs>` of a file, or `unreadable`: what a sealed segment cannot keep if it is rewritten. */
export function fingerprintOf(path: string): string {
  try {
    const stat = statSync(path);
    return `${stat.size}:${stat.mtimeMs}`;
  } catch {
    return 'unreadable';
  }
}

/** `<size>:<mtimeNs>` of a file, or undefined when it cannot be stat'ed. */
function stampOf(path: string): string | undefined {
  const stat = statOf(path);
  return stat === undefined ? undefined : `${stat.size}:${stat.mtimeNs}`;
}

/**
 * The size and modification time, by path, of the segment each tail is appending to, taken BEFORE
 * a reading of the chain begins. {@link activeMarks} records these and not what the file says
 * after the reading, so a rewrite that lands during a long replay leaves a mark older than the
 * bytes (the next open hashes and finds them moved) and never the mark of bytes the rows do not
 * describe.
 */
export function activeStampsBefore(layout: ChainLayout): Readonly<Record<string, string>> {
  const stamps: Record<string, string> = {};
  try {
    for (const tail of listTails(layout)) {
      const last = orderedSegments(layout, tail).at(-1);
      const stamp = last === undefined ? undefined : stampOf(last);
      if (last !== undefined && stamp !== undefined) stamps[last] = stamp;
    }
  } catch {
    // Nothing stamped: every mark below is then `unreadable`, and the next open replays.
  }
  return stamps;
}

/**
 * What each tail's ACTIVE segment was when the frontier was taken, by path, as
 * `<size>:<mtimeNs>:<bytes>:<sha256>`: the size and the modification time the file had BEFORE the
 * reading (`before`, from {@link activeStampsBefore}), and the sha256 of its first `bytes` bytes,
 * which is where the reading stopped.
 *
 * The prefix is hashed after the reading, and the mark is kept only if the file still has the
 * stamp it was given before it: a file that moved while it was read, or while it was hashed, is
 * recorded as `unreadable`, which no later open believes. A segment that is not the last the
 * reading reached (a later one stands beside it, so it is sealed) is left to
 * {@link sealedFingerprints} and not hashed.
 */
export function activeMarks(
  frontier: ChainFrontier,
  before: Readonly<Record<string, string>>,
): Readonly<Record<string, string>> {
  const marks: Record<string, string> = {};
  for (const reach of frontier.tails.values()) {
    const boundary = reach.boundary;
    if (boundary === undefined || reach.segments.at(-1) !== boundary.segment) continue;
    marks[boundary.segment] = markOfActive(boundary.segment, boundary.bytes, before);
  }
  return marks;
}

/**
 * The marks to keep when every active segment a cache recorded is still what it recorded, or
 * undefined when one is not: the same size and the same modification time, or else the same bytes
 * below the frontier (the sha256 computed once, because something moved).
 *
 * A segment whose time moved over the same bytes (a `touch`, a checkout that wrote the file back)
 * comes back with the mark of its new size and time, so the caller can keep it and the next open
 * finds the two numbers equal instead of hashing again.
 */
export function activeSegmentsHold(
  recorded: Readonly<Record<string, string>>,
): Readonly<Record<string, string>> | undefined {
  const kept: Record<string, string> = {};
  for (const [segment, mark] of Object.entries(recorded)) {
    const parts = mark.split(':');
    const [size, mtime, bytes, digest] = parts;
    if (parts.length !== 4 || bytes === undefined || digest === undefined) return undefined;
    const before = stampOf(segment);
    if (before === undefined) return undefined;
    if (before === `${size}:${mtime}`) {
      kept[segment] = mark;
      continue;
    }
    if (prefixDigest(segment, Number(bytes)) !== digest) return undefined;
    // Re-stamped only if the file did not move while it was hashed.
    kept[segment] = stampOf(segment) === before ? `${before}:${bytes}:${digest}` : mark;
  }
  return kept;
}

function markOfActive(
  path: string,
  bytes: number,
  before: Readonly<Record<string, string>>,
): string {
  const stamp = before[path];
  const digest = prefixDigest(path, bytes);
  if (stamp === undefined || digest === undefined || stampOf(path) !== stamp) return 'unreadable';
  return `${stamp}:${bytes}:${digest}`;
}

function statOf(path: string): { size: bigint; mtimeNs: bigint } | undefined {
  try {
    const { size, mtimeNs } = statSync(path, { bigint: true });
    return { size, mtimeNs };
  } catch {
    return undefined;
  }
}

/** The sha256 of the first `bytes` bytes of a file, or undefined when it is shorter or cannot be read. */
function prefixDigest(path: string, bytes: number): string | undefined {
  let fd: number | undefined;
  try {
    fd = openSync(path, 'r');
    const hash = createHash('sha256');
    const chunk = Buffer.allocUnsafe(Math.min(Math.max(bytes, 1), 1 << 20));
    let at = 0;
    while (at < bytes) {
      const read = readSync(fd, chunk, 0, Math.min(chunk.length, bytes - at), at);
      if (read === 0) return undefined;
      hash.update(chunk.subarray(0, read));
      at += read;
    }
    return hash.digest('hex');
  } catch {
    return undefined;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

/** Replaces the active marks alone, leaving the generation where it is: nothing the rows say changed. */
export function writeActiveMarks(
  db: SqliteDatabase,
  active: Readonly<Record<string, string>>,
): void {
  db.prepare("UPDATE cache_meta SET value = ? WHERE key = 'active'").run(JSON.stringify(active));
}
