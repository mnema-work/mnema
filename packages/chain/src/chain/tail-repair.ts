/**
 * PUTTING BACK A LINE OF A PUBLIC TAIL FROM WHAT GIT COMMITTED (ADR-398, ADR-399).
 *
 * A line of a segment that does not read, or whose hash is not the one its content and position
 * give, is the one damage a repository can undo: the line as it was committed is somewhere in the
 * history. This puts it back, and does nothing else. It never appends, never signs, never deletes a
 * line, never cuts the last, incomplete one (a crash's fragment is the reader's own tolerance, not
 * damage), and never touches `checkpoints.jsonl`, `keys/`, `tailproof.json` nor a tree that is not
 * the committed public one. It joins no side of a conflict.
 *
 * A COMMITTED LINE IS TRUSTED ONLY WHEN IT PROVES ITSELF HERE: it reads, its hash is the one its
 * content and position give, its `prev` is the hash of the line before it in the file as it will be
 * left, and the line after it names its hash as its `prev`. A line git holds that does not chain on
 * both sides is somebody's damage that was committed, and nothing is written.
 *
 * THE WHOLE TAIL IS JUDGED BEFORE THE FIRST BYTE: every damaged line is matched, or the tail is
 * left exactly as it was. The write is then one file at a time, each atomic (a temporary beside it,
 * synced, renamed), after a copy of the original segment is kept in the place of the notes
 * (`locks/`, never the record), and under the tail's own lock, so a write in progress is waited out
 * or refused and never interleaved with.
 *
 * THE CITATION INDEX of the tail (`<tail>.citations`) is dropped: it is believed only when the line
 * at its offset carries the hash it names, and a line put back may not have the length of the one it
 * replaced. It is a note, rebuilt from the bytes by the next write.
 */

import {
  closeSync,
  fsyncSync,
  openSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeSync,
} from 'node:fs';
import { join } from 'node:path';
import type { UpcasterRegistry } from '../events/upcaster.js';
import { citationIndexPath } from './citation-index.js';
import { syncDirectory } from './durable.js';
import { type ChainEntry, entryHashHolds, parseEntry } from './entry.js';
import { type ChainLayout, isSegmentFile, tailDir, tailLockPath } from './layout.js';
import {
  parseStoredLine,
  readingWhatTheDiskLets,
  splitLines,
  UnreadableLineError,
} from './lines.js';
import { refuseToLockThroughALink, refuseToWriteThrough } from './linked-write.js';
import { alive, withTailLock } from './tail-lock.js';

/** What the repair of one tail is asked: where it is, where its notes are, and what git holds. */
export interface TailRepairInput {
  readonly layout: ChainLayout;
  /** The layout whose `locks/` holds the tail's lock and notes: the record's own, or the shared place. */
  readonly shared: ChainLayout;
  readonly tailId: string;
  readonly upcasters: UpcasterRegistry;
  /** The segments of this tail as the revision holds them, by file name; a segment it lacks is absent. */
  readonly committed: ReadonlyMap<string, Uint8Array>;
  /** The clock of the copy's name: injected so a test can make two apart. */
  readonly now?: number;
}

/** A line put back. */
export interface LinePutBack {
  /** The segment's file name. */
  readonly segment: string;
  /** The line's place in the file, from 1. */
  readonly line: number;
  readonly seq: number;
  /** Why it was put back: it did not read, or its hash did not hold. */
  readonly was: 'unreadable' | 'altered';
}

/** Why nothing was written. */
export type TailRepairRefusal =
  /** A line of a segment is a conflict marker git left: a merge is to be redone, not joined. */
  | { readonly reason: 'CONFLICT_MARKS'; readonly segment: string; readonly line: number }
  /** The revision has no such line, or no such segment. */
  | { readonly reason: 'NOT_IN_REVISION'; readonly segment: string; readonly line: number }
  /** The line is the same bytes in the revision and does not read: a newer mnema wrote it. */
  | { readonly reason: 'NEWER_MNEMA'; readonly segment: string; readonly line: number }
  /** The line in the revision differs and does not read or does not hold its hash, or is as damaged. */
  | { readonly reason: 'NOT_COMMITTED_INTACT'; readonly segment: string; readonly line: number }
  /** The line in the revision reads and holds, and does not chain to its neighbours. */
  | {
      readonly reason: 'NOT_CHAINED';
      readonly segment: string;
      readonly line: number;
      readonly side: 'before' | 'after' | 'tail';
    };

export type TailRepaired =
  | {
      readonly ok: true;
      readonly repaired: readonly LinePutBack[];
      /** The copies of the segments as they were, in the place of the notes, one per segment changed. */
      readonly kept: readonly string[];
    }
  | { readonly ok: false; readonly refusal: TailRepairRefusal };

/** One line of the tail, in the order of the tail, as the repair walks it. */
interface Placed {
  readonly segment: string;
  /** The piece's index in its file, from 0. */
  readonly index: number;
  readonly bytes: Uint8Array;
}

/** What a stored line is to this reader: sound, or damaged in one of the two ways a repair undoes. */
type Judged =
  | { readonly state: 'holds'; readonly entry: ChainEntry }
  | { readonly state: 'unreadable' }
  | { readonly state: 'altered'; readonly entry: ChainEntry };

function judge(bytes: Uint8Array, upcasters: UpcasterRegistry): Judged {
  let entry: ChainEntry | null;
  try {
    entry = parseStoredLine(
      bytes,
      false,
      (text) => parseEntry(text, upcasters),
      () => '',
    );
  } catch (error) {
    if (error instanceof UnreadableLineError) return { state: 'unreadable' };
    throw error;
  }
  if (entry === null) return { state: 'unreadable' };
  return entryHashHolds(entry) ? { state: 'holds', entry } : { state: 'altered', entry };
}

const MARKS = [/^<{7}( |$)/, /^={7}$/, /^>{7}( |$)/];

function isAConflictMark(piece: Uint8Array): boolean {
  const head = Buffer.from(piece.subarray(0, 9)).toString('latin1');
  return MARKS.some((mark) => mark.test(head));
}

/**
 * Puts back, from `input.committed`, every line of the segments of one tail that does not read or
 * does not hold its hash, or refuses and writes nothing. With no such line it writes nothing and
 * says so (`repaired` empty).
 */
export function repairTail(input: TailRepairInput): TailRepaired {
  const { layout, shared, tailId, upcasters, committed } = input;
  // Before the lock: a lock taken through a link is the first write.
  refuseToLockThroughALink(shared, tailId);
  return withTailLock(tailLockPath(shared, tailId), () => {
    const directory = tailDir(layout, tailId);
    const segments = readingWhatTheDiskLets(directory, `tails/${tailId}`, () =>
      readdirSync(directory),
    )
      .filter(isSegmentFile)
      .sort();
    refuseToWriteThrough(layout, ['tails', `tails/${tailId}`]);
    refuseToWriteThrough(
      layout,
      segments.map((name) => `tails/${tailId}/${name}`),
    );
    refuseToWriteThrough(shared, ['locks', `locks/${tailId}.citations`]);
    sweepStaging(shared, directory, tailId);

    const files = new Map<string, { pieces: Uint8Array[]; torn: boolean }>();
    const walk: Placed[] = [];
    for (const [at, segment] of segments.entries()) {
      const raw = readingWhatTheDiskLets(
        join(directory, segment),
        `tails/${tailId}/${segment}`,
        () => readFileSync(join(directory, segment)),
      );
      const pieces = splitLines(raw);
      const torn = at === segments.length - 1 && raw.length > 0 && raw.at(-1) !== 0x0a;
      files.set(segment, { pieces, torn });
      for (const [index, piece] of pieces.entries()) {
        if (isAConflictMark(piece)) {
          return { ok: false, refusal: { reason: 'CONFLICT_MARKS', segment, line: index + 1 } };
        }
        if (piece.length === 0) continue;
        // The fragment a crash left at the end is the reader's tolerance, and not this verb's to cut.
        if (torn && index === pieces.length - 1) continue;
        walk.push({ segment, index, bytes: piece });
      }
    }

    // Judged in the order of the tail, so a line's neighbours are known as they will be left.
    const judged = walk.map((one) => judge(one.bytes, upcasters));
    const replaced = new Map<number, Uint8Array>();
    const repaired: LinePutBack[] = [];
    let previous: ChainEntry | undefined;
    for (const [at, one] of walk.entries()) {
      const here = judged[at] as Judged;
      const where = { segment: one.segment, line: one.index + 1 };
      if (here.state === 'holds') {
        previous = here.entry;
        continue;
      }
      const theirs = splitLines(committed.get(one.segment) ?? new Uint8Array())[one.index];
      if (theirs === undefined || theirs.length === 0 || !committed.has(one.segment)) {
        return { ok: false, refusal: { reason: 'NOT_IN_REVISION', ...where } };
      }
      if (Buffer.compare(Buffer.from(theirs), Buffer.from(one.bytes)) === 0) {
        return {
          ok: false,
          refusal: {
            reason: here.state === 'unreadable' ? 'NEWER_MNEMA' : 'NOT_COMMITTED_INTACT',
            ...where,
          },
        };
      }
      const back = judge(theirs, upcasters);
      if (back.state !== 'holds') {
        return { ok: false, refusal: { reason: 'NOT_COMMITTED_INTACT', ...where } };
      }
      const link = back.entry.link;
      const before = previous === undefined ? null : previous.link.hash;
      const seqBefore = previous === undefined ? -1 : previous.link.seq;
      if (link.tail !== tailId || link.prev !== before || link.seq !== seqBefore + 1) {
        return { ok: false, refusal: { reason: 'NOT_CHAINED', ...where, side: 'before' } };
      }
      // The line after, when it is not itself to be put back, names this one as its `prev`.
      const next = judged[at + 1];
      if (next?.state === 'holds' && next.entry.link.prev !== link.hash) {
        return { ok: false, refusal: { reason: 'NOT_CHAINED', ...where, side: 'after' } };
      }
      replaced.set(at, theirs);
      repaired.push({
        segment: one.segment,
        line: one.index + 1,
        seq: link.seq,
        was: here.state,
      });
      previous = back.entry;
    }
    if (repaired.length === 0) return { ok: true, repaired, kept: [] };

    // Whole, and about to be written: the pieces of each file with the lines put back.
    for (const [at, theirs] of replaced) {
      const one = walk[at] as Placed;
      (files.get(one.segment) as { pieces: Uint8Array[] }).pieces[one.index] = theirs;
    }
    const changed = [...new Set(repaired.map((one) => one.segment))];
    const stamp = input.now ?? Date.now();
    const copies = changed.map((segment) =>
      join(shared.root, 'locks', `${tailId}.${segment}.${stamp}.before-repair`),
    );
    refuseToWriteThrough(
      shared,
      copies.map((copy) => `locks/${copy.slice(copy.lastIndexOf('/') + 1)}`),
    );
    for (const [at, segment] of changed.entries()) {
      const copy = copies[at] as string;
      // 'wx': a copy already there is never overwritten.
      const fd = openSync(copy, 'wx');
      try {
        writeSync(fd, readFileSync(join(directory, segment)));
        fsyncSync(fd);
      } finally {
        closeSync(fd);
      }
    }
    syncDirectory(join(shared.root, 'locks'));
    // Before any file changes: an index is believed only when the line at its offset carries the hash it
    // names, and a reader between a rename and the drop would meet one that no longer does.
    rmSync(citationIndexPath(shared, tailId), { force: true });
    for (const segment of changed) {
      const target = join(directory, segment);
      const file = files.get(segment) as { pieces: Uint8Array[] };
      const body = Buffer.concat(
        file.pieces.flatMap((piece, index) =>
          index === 0 ? [Buffer.from(piece)] : [Buffer.from([0x0a]), Buffer.from(piece)],
        ),
      );
      // Staged in the place of the notes, never in the record: a process killed here leaves nothing in the
      // tree git versions. A place on another file system cannot be renamed from, so there the temporary
      // goes beside the file, under a name the readers pass over (`.<segment>.repair.<pid>`).
      const staged = join(shared.root, 'locks', `${tailId}.${segment}.repair.${process.pid}`);
      const beside = join(directory, `.${segment}.repair.${process.pid}`);
      const mode = statSync(target).mode & 0o777;
      let at = staged;
      try {
        stage(at, body, mode);
        try {
          renameSync(at, target);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'EXDEV') throw error;
          at = beside;
          stage(at, body, mode);
          renameSync(at, target);
        }
      } finally {
        rmSync(staged, { force: true });
        rmSync(beside, { force: true });
      }
      syncDirectory(directory);
    }
    return { ok: true, repaired, kept: copies };
  });
}

/** Writes `body` to a new file at `path`, synced. */
function stage(path: string, body: Buffer, mode: number): void {
  rmSync(path, { force: true });
  const fd = openSync(path, 'wx', mode);
  try {
    writeSync(fd, body);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

/** Removes the staging files an earlier repair left when its process was killed: the ones of a dead pid. */
function sweepStaging(shared: ChainLayout, directory: string, tailId: string): void {
  const found = (dir: string, pattern: RegExp): string[] =>
    readdirSync(dir)
      .filter((name) => pattern.test(name))
      .map((name) => join(dir, name));
  const dead = (path: string): boolean => {
    const pid = Number(path.slice(path.lastIndexOf('.') + 1));
    return Number.isInteger(pid) && !alive(pid);
  };
  const escaped = tailId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const staged = [
    ...found(
      join(shared.root, 'locks'),
      new RegExp(`^${escaped}\\.\\d{6}\\.jsonl\\.repair\\.\\d+$`),
    ),
    ...found(directory, /^\.\d{6}\.jsonl\.repair\.\d+$/),
  ];
  for (const path of staged) if (dead(path)) rmSync(path, { force: true });
}
