/**
 * The tails of one key that a write in a worktree may go on with, when the tail its hint names does
 * not go on here (ADR-445, ADR-446): the choice between continuing a tail this machine already
 * writes and founding one.
 *
 * WHY. A tail is continued only where its end in this checkout is the entry this machine wrote last
 * (`recover()` in `writer.ts`), so a worktree that finds its hint at another end used to found a tail
 * for it: one per visit to a branch, one per new worktree. The notes are shared by every worktree of
 * a repository (FORMAT.md section 4), so the tails this machine writes can be looked through, and one
 * that ends here where this machine left it is continued instead of founding another.
 *
 * WHICH. A tail is offered only when all of these hold, asked without any lock (a candidate is
 * judged again under its own lock before a byte is written to it):
 *   - it is in this checkout, and the end it has here is the entry its note says this machine wrote
 *     last (a note that no longer matches is a tail some other branch moved: there are many of
 *     those, and they are dropped by two reads each);
 *   - no other worktree that still exists names it as its own hint (a preference, not a safety: it
 *     keeps a new worktree from taking the tail a session in another is writing);
 *   - and it is either a tail this worktree wrote ON THE BRANCH IT IS ON NOW (its mark names the branch),
 *     or its end is already on the base branch (ADR-446). A branch cut from the one that wrote a tail
 *     asks the base branch like any other, and so does a detached HEAD. Two branches then never write
 *     one tail file past the point they share, which a squash merge on a host with no merge driver
 *     cannot settle.
 * The oldest note comes first, so the tail that has been idle longest is taken before one a session
 * may have just left, and at most {@link JUDGED_AT_MOST} candidates are looked at in full.
 */

import { mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname } from 'node:path';
import type { UpcasterRegistry } from '../events/upcaster.js';
import { type KeptHead, keptHeadPath, readKeptHead } from './kept-head.js';
import { type ChainLayout, inflightPath } from './layout.js';
import { listTails, orderedSegments, readTailTip } from './store.js';

/** How many candidates of the pool are put to the lock and judged in one write, and asked of the base branch. */
export const JUDGED_AT_MOST = 16;

/** What the caller of a writer knows about the repository the tails are in. */
export interface PoolOptions {
  /** The checkout's place: where its hint of the installation id and its marks are (`<place>/keys`, `<place>/inflight`). */
  readonly checkoutRoot: string;
  /** The installation ids that the other worktrees of the repository which still exist name as their hint. */
  readonly reservedBy: (fingerprint: string) => ReadonlySet<string>;
  /** Whether the entry with `hash` is in the segment `segment` of `tailId` on the base branch; false where that cannot be said. */
  readonly onBase: (tailId: string, segment: string, hash: string) => boolean;
  /** The branch this worktree has checked out, or undefined for a detached HEAD. */
  readonly branch: () => string | undefined;
}

/** The hint of the installation id as the writer reads and moves it: the keystore's, behind two calls. */
export interface HintOfTheId {
  readonly read: () => string;
  readonly adopt: (installationId: string) => void;
}

/** What a look through the pool found. */
export interface PoolScan {
  /** The tails to try, in order. */
  readonly queue: readonly string[];
  /** The tails of the key in this checkout, the one the write is leaving included. */
  readonly known: number;
  /** How many of the others have a note in the shared place. */
  readonly noted: number;
  /** Whether one that would have been offered was left because another worktree names it as its hint. */
  readonly reserved: boolean;
}

/**
 * Marks that this worktree began an act that ends at `next` on `tailId`, on `branch` (empty for a
 * detached HEAD): `<seq> <hash>` and the branch on a line of its own. Best effort: it only narrows.
 */
export function markInflight(
  checkout: ChainLayout,
  tailId: string,
  next: KeptHead,
  branch: string | undefined,
): void {
  const path = inflightPath(checkout, tailId);
  const staging = `${path}.${process.pid}`;
  try {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(staging, `${next.seq} ${next.hash}\n${branch ?? ''}\n`);
    renameSync(staging, path);
  } catch {
    // A mark that was not kept sends this worktree to another tail the next time it meets that end.
  }
}

/** What this worktree's mark for a tail says: the entry the last act began on it was to write, and the branch. */
function readMark(
  checkout: ChainLayout,
  tailId: string,
): { readonly next: string; readonly branch: string } | undefined {
  try {
    const [next, branch] = readFileSync(inflightPath(checkout, tailId), 'utf-8').split('\n');
    return { next: next as string, branch: branch ?? '' };
  } catch {
    return undefined;
  }
}

/** Whether this worktree's mark for `tailId` names `next`: an act it began, which is its to finish. */
export function inflightNames(checkout: ChainLayout, tailId: string, next: KeptHead): boolean {
  return readMark(checkout, tailId)?.next === `${next.seq} ${next.hash}`;
}

/**
 * Whether this worktree wrote to `tailId` on `branch`, the branch it is on now: a tail only a branch
 * holds is gone on with, without asking the base branch, only by the branch that wrote it. On any other
 * branch (a branch cut from it, a detached HEAD) it is asked like any other tail (ADR-446).
 */
export function wroteOnThisBranch(
  checkout: ChainLayout,
  tailId: string,
  branch: string | undefined,
): boolean {
  const mark = readMark(checkout, tailId);
  return mark !== undefined && branch !== undefined && mark.branch === branch;
}

/** Whether this worktree wrote to `tailId` at all, on whatever branch. */
export function wroteHere(checkout: ChainLayout, tailId: string): boolean {
  return readMark(checkout, tailId) !== undefined;
}

/** The entry a tail ends with in this checkout, and the segment holding it; undefined for a tail that cannot be read. */
function endOf(
  layout: ChainLayout,
  tailId: string,
  upcasters: UpcasterRegistry,
): { readonly end: KeptHead; readonly segment: string } | undefined {
  try {
    const segment = orderedSegments(layout, tailId).at(-1);
    if (segment === undefined) return undefined;
    const last = readTailTip(layout, tailId, upcasters, Number.MAX_SAFE_INTEGER).at(-1);
    if (last === undefined) return undefined;
    return { end: { seq: last.link.seq, hash: last.link.hash }, segment: basename(segment) };
  } catch {
    // A tail this checkout cannot read (a link, a torn line) is not one to go on with.
    return undefined;
  }
}

/** Looks through the tails of `fingerprint` for the ones this worktree may go on with: see the file's head. */
export function scanThePool(args: {
  readonly layout: ChainLayout;
  readonly shared: ChainLayout;
  readonly checkout: ChainLayout;
  readonly fingerprint: string;
  /** The tails not to offer: the one the write is leaving, and the ones this write already tried. */
  readonly except: ReadonlySet<string>;
  readonly pool: PoolOptions;
  readonly upcasters: UpcasterRegistry;
}): PoolScan {
  const { layout, shared, checkout, fingerprint, except, pool, upcasters } = args;
  const prefix = `${fingerprint}-`;
  const known = listTails(layout).filter((tail) => tail.startsWith(prefix));
  const others = known.filter((tail) => !except.has(tail));
  const reservedIds = pool.reservedBy(fingerprint);
  const branch = pool.branch();
  let noted = 0;
  let reserved = false;
  const found: { tail: string; modified: number; end: KeptHead; segment: string }[] = [];
  for (const tail of others) {
    const note = readKeptHead(shared, tail);
    if (note === undefined) continue;
    noted += 1;
    const read = endOf(layout, tail, upcasters);
    if (read === undefined || read.end.seq !== note.seq || read.end.hash !== note.hash) continue;
    if (reservedIds.has(tail.slice(prefix.length))) {
      reserved = true;
      continue;
    }
    let modified = 0;
    try {
      modified = statSync(keptHeadPath(shared, tail)).mtimeMs;
    } catch {
      // Read a moment ago: a note that vanished since sorts first and is judged for what it is.
    }
    found.push({ tail, modified, end: read.end, segment: read.segment });
  }
  found.sort((a, b) => a.modified - b.modified || (a.tail < b.tail ? -1 : 1));
  const queue: string[] = [];
  let asked = 0;
  for (const candidate of found) {
    if (queue.length >= JUDGED_AT_MOST) break;
    if (wroteOnThisBranch(checkout, candidate.tail, branch)) {
      queue.push(candidate.tail);
      continue;
    }
    if (asked >= JUDGED_AT_MOST) continue;
    asked += 1;
    if (pool.onBase(candidate.tail, candidate.segment, candidate.end.hash))
      queue.push(candidate.tail);
  }
  return { queue, known: known.length, noted, reserved };
}
