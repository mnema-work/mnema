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
 *
 * THE WHOLE TAIL, WHEN EVERY LINE HOLDS AND ITS SIGNED CHECKPOINTS DO NOT (ADR-559, ADR-563). A tail
 * rewritten and re-chained, its checkpoints emptied or forged, a signed event gone, or events no
 * signature proves that the revision does not hold either: then the revision's tail is put back,
 * extended by what is proven over it (`whole-tail.ts` decides), `checkpoints.jsonl` included. Each
 * file that changes is kept first beside the lock as it was, the segments are put in place before
 * `checkpoints.jsonl` (a kill between leaves checkpoints that still do not hold, and a second run
 * finishes), and still nothing is signed, and `keys/`, `tailproof.json`, the notes in `locks/` and
 * every other tail are not touched. Lines first: when a line is put back, the whole tail waits for
 * the next run, and the result says so.
 */

import {
  closeSync,
  existsSync,
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
import { decodeStoredBytes } from '../events/stored-json.js';
import type { UpcasterRegistry } from '../events/upcaster.js';
import { type Checkpoint, parseCheckpoint } from './checkpoint.js';
import { citationIndexPath } from './citation-index.js';
import { syncDirectory } from './durable.js';
import { type ChainEntry, entryHashHolds, parseEntry } from './entry.js';
import { readWrittenHead, type WrittenHead } from './kept-head.js';
import {
  type ChainLayout,
  checkpointsPath,
  isSegmentFile,
  tailDir,
  tailFingerprint,
  tailLockPath,
  tailProofPath,
} from './layout.js';
import {
  parseStoredLine,
  readingWhatTheDiskLets,
  splitLines,
  UnreadableLineError,
} from './lines.js';
import { refuseToLockThroughALink, refuseToWriteThrough } from './linked-write.js';
import { type CommittedKeys, committedKeys } from './store.js';
import { alive, withTailLock } from './tail-lock.js';
import { parseTailProof, verifyTailProof } from './tailproof.js';
import {
  planWholeTail,
  type SeqRun,
  type StoredCheckpoint,
  type StoredEvent,
  theWholeTailIsNeeded,
  type WholeTailRefusal,
} from './whole-tail.js';
import { DEFAULT_MAX_UNSIGNED_EVENTS } from './writer.js';

/** What the repair of one tail is asked: where it is, where its notes are, and what git holds. */
export interface TailRepairInput {
  readonly layout: ChainLayout;
  /** The layout whose `locks/` holds the tail's lock and notes: the record's own, or the shared place. */
  readonly shared: ChainLayout;
  readonly tailId: string;
  readonly upcasters: UpcasterRegistry;
  /** The segments of this tail as the revision holds them, by file name; a segment it lacks is absent. */
  readonly committed: ReadonlyMap<string, Uint8Array>;
  /** The tail's `checkpoints.jsonl` as the revision holds it; absent when it holds none. */
  readonly committedCheckpoints?: Uint8Array;
  /** The clock of the copy's name: injected so a test can make two apart. */
  readonly now?: number;
  /** Called after each file is put in place or removed: a test stops the process there. */
  readonly afterEachFile?: (file: string) => void;
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

/** What putting a whole tail back changed. */
export interface WholeTailPutBack {
  /** The segment files written or removed. */
  readonly segments: readonly string[];
  /** The lines of those segments that are not what was there at their place. */
  readonly lines: number;
  /** The lines of `checkpoints.jsonl` that are not what was there at their place. */
  readonly checkpointLines: number;
  readonly keptAbove: readonly SeqRun[];
  readonly removed: readonly SeqRun[];
  readonly relinked: readonly SeqRun[];
}

export type TailRepaired =
  | {
      readonly ok: true;
      readonly repaired: readonly LinePutBack[];
      /** The copies of the files as they were, in the place of the notes, one per file changed. */
      readonly kept: readonly string[];
      /** Lines were put back and the tail's checkpoints still do not hold: the next run puts the whole tail back. */
      readonly stillFails?: true;
      /** Present when the whole tail was put back. */
      readonly whole?: WholeTailPutBack;
    }
  | { readonly ok: false; readonly refusal: TailRepairRefusal }
  | { readonly ok: false; readonly whole: WholeTailRefusal };

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
    const after: StoredEvent[] = [];
    let previous: ChainEntry | undefined;
    for (const [at, one] of walk.entries()) {
      const here = judged[at] as Judged;
      const where = { segment: one.segment, line: one.index + 1 };
      if (here.state === 'holds') {
        previous = here.entry;
        after.push({ entry: here.entry, segment: one.segment, bytes: one.bytes });
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
      after.push({ entry: back.entry, segment: one.segment, bytes: theirs });
      repaired.push({
        segment: one.segment,
        line: one.index + 1,
        seq: link.seq,
        was: here.state,
      });
      previous = back.entry;
    }
    const keys = committedKeys(layout);
    const note = noteOf(layout, shared, tailId, keys);
    const working = checkpointsOf(directory, tailId);
    const revision = revisionOf(input);
    const needed = (entries: readonly StoredEvent[]): boolean =>
      working.conflict !== undefined ||
      theWholeTailIsNeeded({
        tail: tailId,
        entries: entries.map((one) => one.entry),
        checkpoints: working.checkpoints.map((one) => one.checkpoint),
        checkpointsRead: working.read,
        keys,
        window: DEFAULT_MAX_UNSIGNED_EVENTS,
        revision: new Set(revision.ok ? revision.events.map((one) => one.entry.link.hash) : []),
        ...(note !== undefined ? { note } : {}),
      });
    if (repaired.length === 0) {
      if (!needed(after)) return { ok: true, repaired, kept: [] };
      return putTheWholeTailBack(input, {
        directory,
        segments,
        files,
        keys,
        working,
        revision,
        after,
        ...(note !== undefined ? { note } : {}),
      });
    }

    // Whole, and about to be written: the pieces of each file with the lines put back.
    for (const [at, theirs] of replaced) {
      const one = walk[at] as Placed;
      (files.get(one.segment) as { pieces: Uint8Array[] }).pieces[one.index] = theirs;
    }
    const changed = [...new Set(repaired.map((one) => one.segment))];
    const copies = keepAsTheyWere(shared, directory, tailId, changed, input.now ?? Date.now());
    for (const segment of changed) {
      const file = files.get(segment) as { pieces: Uint8Array[] };
      putInPlace(shared, directory, tailId, segment, joined(file.pieces));
      input.afterEachFile?.(segment);
    }
    return {
      ok: true,
      repaired,
      kept: copies,
      ...(needed(after) ? { stillFails: true as const } : {}),
    };
  });
}

/** The lines of a file, joined as the file holds them. */
function joined(pieces: readonly Uint8Array[]): Buffer {
  return Buffer.concat(
    pieces.flatMap((piece, index) =>
      index === 0 ? [Buffer.from(piece)] : [Buffer.from([0x0a]), Buffer.from(piece)],
    ),
  );
}

/**
 * Keeps each of `files` of the tail as it is now in the place of the notes, never overwriting a copy,
 * then drops the citation index: before any file changes, since an index is believed only when the
 * line at its offset carries the hash it names, and a reader between a rename and the drop would
 * meet one that no longer does.
 */
function keepAsTheyWere(
  shared: ChainLayout,
  directory: string,
  tailId: string,
  files: readonly string[],
  stamp: number,
  fromRevision: ReadonlyMap<string, Uint8Array> = new Map(),
): string[] {
  // A file of the tail as the working tree holds it, then one as the revision holds it, where the
  // result leaves out events of the revision that the working tree does not hold.
  const kept = [
    ...files.map((file) => ({
      file,
      copy: join(shared.root, 'locks', `${tailId}.${file}.${stamp}.before-repair`),
      bytes: (): Uint8Array =>
        existsSync(join(directory, file)) ? readFileSync(join(directory, file)) : new Uint8Array(),
    })),
    ...[...fromRevision].map(([file, bytes]) => ({
      file,
      copy: join(shared.root, 'locks', `${tailId}.${file}.${stamp}.revision.before-repair`),
      bytes: (): Uint8Array => bytes,
    })),
  ];
  const copies = kept.map((one) => one.copy);
  refuseToWriteThrough(
    shared,
    copies.map((copy) => `locks/${copy.slice(copy.lastIndexOf('/') + 1)}`),
  );
  for (const one of kept) {
    // 'wx': a copy already there is never overwritten.
    const fd = openSync(one.copy, 'wx');
    try {
      writeSync(fd, one.bytes());
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
  }
  syncDirectory(join(shared.root, 'locks'));
  rmSync(citationIndexPath(shared, tailId), { force: true });
  return copies;
}

/**
 * Puts `body` in place as `file` of the tail: staged in the place of the notes, never in the record,
 * so a process killed here leaves nothing in the tree git versions. A place on another file system
 * cannot be renamed from, so there the temporary goes beside the file, under a name the readers pass
 * over (`.<file>.repair.<pid>`).
 */
function putInPlace(
  shared: ChainLayout,
  directory: string,
  tailId: string,
  file: string,
  body: Buffer,
  mode?: number,
): void {
  const target = join(directory, file);
  const staged = join(shared.root, 'locks', `${tailId}.${file}.repair.${process.pid}`);
  const beside = join(directory, `.${file}.repair.${process.pid}`);
  const kept = mode ?? statSync(target).mode & 0o777;
  let at = staged;
  try {
    stage(at, body, kept);
    try {
      renameSync(at, target);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EXDEV') throw error;
      at = beside;
      stage(at, body, kept);
      renameSync(at, target);
    }
  } finally {
    rmSync(staged, { force: true });
    rmSync(beside, { force: true });
  }
  syncDirectory(directory);
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

/**
 * This machine's signed note of the tail, verified under the tail's committed key bound to its
 * fingerprint (ADR-566): the shared place first, then the tree's own `locks/`.
 */
function noteOf(
  layout: ChainLayout,
  shared: ChainLayout,
  tailId: string,
  keys: CommittedKeys,
): WrittenHead | undefined {
  const owner = tailFingerprint(tailId);
  const key = keys(owner);
  if (key === null || key.fingerprint() !== owner) return undefined;
  return readWrittenHead(shared, tailId, key.key) ?? readWrittenHead(layout, tailId, key.key);
}

/** The lines of a `checkpoints.jsonl`: a torn last one dropped, as every reader drops it. */
interface CheckpointsRead {
  readonly checkpoints: readonly StoredCheckpoint[];
  /** False when a line that is not the last does not read as a checkpoint. */
  readonly read: boolean;
  /** The first line that is a conflict marker, from 1. */
  readonly conflict?: number;
  readonly firstUnread?: number;
}

function checkpointLinesOf(raw: Uint8Array | undefined): CheckpointsRead {
  if (raw === undefined) return { checkpoints: [], read: true };
  const pieces = splitLines(raw);
  const torn = raw.length > 0 && raw.at(-1) !== 0x0a;
  const checkpoints: StoredCheckpoint[] = [];
  let conflict: number | undefined;
  let firstUnread: number | undefined;
  for (const [index, piece] of pieces.entries()) {
    if (piece.length === 0) continue;
    if (isAConflictMark(piece)) conflict ??= index + 1;
    let checkpoint: Checkpoint | undefined;
    try {
      checkpoint = parseCheckpoint(decodeStoredBytes(piece));
    } catch {
      checkpoint = undefined;
    }
    if (checkpoint !== undefined) checkpoints.push({ checkpoint, bytes: piece });
    else if (!(torn && index === pieces.length - 1)) firstUnread ??= index + 1;
  }
  return {
    checkpoints,
    read: firstUnread === undefined,
    ...(conflict !== undefined ? { conflict } : {}),
    ...(firstUnread !== undefined ? { firstUnread } : {}),
  };
}

/** The working tail's `checkpoints.jsonl`, as {@link checkpointLinesOf} reads it. */
function checkpointsOf(directory: string, tailId: string): CheckpointsRead {
  const path = join(directory, 'checkpoints.jsonl');
  if (!existsSync(path)) return { checkpoints: [], read: true };
  return checkpointLinesOf(
    readingWhatTheDiskLets(path, `tails/${tailId}/checkpoints.jsonl`, () => readFileSync(path)),
  );
}

/** The revision's tail: its events in order, and its checkpoints, or the line that does not read. */
type Revision =
  | {
      readonly ok: true;
      readonly events: readonly StoredEvent[];
      readonly checkpoints: readonly StoredCheckpoint[];
    }
  | { readonly ok: false; readonly refusal: WholeTailRefusal };

function revisionOf(input: TailRepairInput): Revision {
  const names = [...input.committed.keys()].filter(isSegmentFile).sort();
  const events: StoredEvent[] = [];
  for (const [at, segment] of names.entries()) {
    const raw = input.committed.get(segment) as Uint8Array;
    const pieces = splitLines(raw);
    const torn = at === names.length - 1 && raw.length > 0 && raw.at(-1) !== 0x0a;
    for (const [index, piece] of pieces.entries()) {
      if (piece.length === 0 || (torn && index === pieces.length - 1)) continue;
      const judged = judge(piece, input.upcasters);
      if (judged.state === 'unreadable') {
        return {
          ok: false,
          refusal: {
            reason: 'REVISION_DOES_NOT_HOLD',
            file: segment,
            line: index + 1,
            fault: 'does not read',
          },
        };
      }
      events.push({ entry: judged.entry, segment, bytes: piece });
    }
  }
  const read = checkpointLinesOf(input.committedCheckpoints);
  if (!read.read || read.conflict !== undefined) {
    return {
      ok: false,
      refusal: {
        reason: 'REVISION_DOES_NOT_HOLD',
        file: 'checkpoints.jsonl',
        line: read.conflict ?? (read.firstUnread as number),
        fault: 'does not read',
      },
    };
  }
  return { ok: true, events, checkpoints: read.checkpoints };
}

/** What {@link putTheWholeTailBack} is handed by the reading done under the lock. */
interface WholeTailReading {
  readonly directory: string;
  readonly segments: readonly string[];
  readonly files: ReadonlyMap<string, { pieces: Uint8Array[]; torn: boolean }>;
  readonly keys: CommittedKeys;
  readonly note?: WrittenHead;
  readonly working: CheckpointsRead;
  readonly revision: Revision;
  /** The working tail's events, every one of which reads and holds its hash. */
  readonly after: readonly StoredEvent[];
}

/** Puts the whole tail back as {@link planWholeTail} decides, or refuses with nothing written. */
function putTheWholeTailBack(input: TailRepairInput, reading: WholeTailReading): TailRepaired {
  const { layout, shared, tailId } = input;
  const { directory, segments, files, keys, note, working, revision } = reading;
  if (working.conflict !== undefined) {
    return {
      ok: false,
      whole: { reason: 'CONFLICT_MARKS', file: 'checkpoints.jsonl', line: working.conflict },
    };
  }
  if (!revision.ok) return { ok: false, whole: revision.refusal };
  const proofHolds = tailProofFault(layout, tailId, keys);
  if (proofHolds !== undefined) {
    return { ok: false, whole: { reason: 'TAILPROOF_DOES_NOT_HOLD', fault: proofHolds } };
  }
  const planned = planWholeTail({
    tail: tailId,
    working: reading.after,
    workingCheckpoints: working.checkpoints,
    revision: revision.events,
    revisionCheckpoints: revision.checkpoints,
    keys,
    window: DEFAULT_MAX_UNSIGNED_EVENTS,
    ...(note !== undefined ? { note } : {}),
  });
  if (!planned.ok) return { ok: false, whole: planned.refusal };
  const { plan } = planned;

  // The files as they are to be left: each event in the segment it came from, in seq order.
  const bodies = new Map<string, Uint8Array[]>();
  let last = '';
  for (const one of plan.entries) {
    if (one.segment < last) {
      return {
        ok: false,
        whole: { reason: 'DOES_NOT_HOLD_AFTER', fault: 'segments out of order' },
      };
    }
    last = one.segment;
    const pieces = bodies.get(one.segment) ?? [];
    pieces.push(one.bytes);
    bodies.set(one.segment, pieces);
  }
  const now = (segment: string): Uint8Array =>
    existsSync(join(directory, segment))
      ? readFileSync(join(directory, segment))
      : new Uint8Array();
  const bodyOf = (pieces: readonly Uint8Array[]): Buffer =>
    pieces.length === 0 ? Buffer.alloc(0) : Buffer.concat([joined(pieces), Buffer.from([0x0a])]);
  const differing = (pieces: readonly Uint8Array[], before: readonly Uint8Array[]): number =>
    pieces.filter((piece, at) => {
      const was = before[at];
      return was === undefined || Buffer.compare(Buffer.from(piece), Buffer.from(was)) !== 0;
    }).length;
  const written = [...bodies.entries()]
    .filter(([segment, pieces]) => !bodyOf(pieces).equals(Buffer.from(now(segment))))
    .map(([segment]) => segment)
    .sort();
  const removed = segments.filter((segment) => !bodies.has(segment));
  const checkpointsBody = bodyOf(plan.checkpoints.map((one) => one.bytes));
  const checkpointsFile = checkpointsPath(layout, tailId);
  const checkpointsBefore = existsSync(checkpointsFile) ? readFileSync(checkpointsFile) : undefined;
  const checkpointsChange =
    checkpointsBefore === undefined || !checkpointsBody.equals(checkpointsBefore);
  if (written.length === 0 && removed.length === 0 && !checkpointsChange) {
    return { ok: true, repaired: [], kept: [] };
  }

  refuseToWriteThrough(layout, [`tails/${tailId}/checkpoints.jsonl`]);
  const changed = [...written, ...removed, ...(checkpointsChange ? ['checkpoints.jsonl'] : [])];
  const copies = keepAsTheyWere(
    shared,
    directory,
    tailId,
    changed,
    input.now ?? Date.now(),
    new Map(
      plan.revisionAside.map((segment) => [
        segment,
        input.committed.get(segment) ?? new Uint8Array(),
      ]),
    ),
  );
  const mode = statSync(join(directory, segments[0] ?? 'checkpoints.jsonl')).mode & 0o777;
  // The segments first, `checkpoints.jsonl` last: a kill between leaves checkpoints that do not
  // hold over the segments put back, and the next run finishes.
  for (const segment of written) {
    putInPlace(shared, directory, tailId, segment, bodyOf(bodies.get(segment) ?? []), mode);
    input.afterEachFile?.(segment);
  }
  for (const segment of removed) {
    rmSync(join(directory, segment), { force: true });
    syncDirectory(directory);
    input.afterEachFile?.(segment);
  }
  if (checkpointsChange) {
    putInPlace(shared, directory, tailId, 'checkpoints.jsonl', checkpointsBody, mode);
    input.afterEachFile?.('checkpoints.jsonl');
  }
  const linesBefore = (segment: string): Uint8Array[] =>
    (files.get(segment)?.pieces ?? []).filter((piece) => piece.length > 0);
  return {
    ok: true,
    repaired: [],
    kept: copies,
    whole: {
      segments: [...written, ...removed].sort(),
      lines: written.reduce(
        (sum, segment) => sum + differing(bodies.get(segment) ?? [], linesBefore(segment)),
        0,
      ),
      checkpointLines: checkpointsChange
        ? differing(
            plan.checkpoints.map((one) => one.bytes),
            checkpointsBefore === undefined
              ? []
              : splitLines(checkpointsBefore).filter((piece) => piece.length > 0),
          )
        : 0,
      keptAbove: plan.keptAbove,
      removed: plan.removed,
      relinked: plan.relinked,
    },
  };
}

/** Why the working `tailproof.json` does not verify under the tail's committed key, or undefined. */
function tailProofFault(
  layout: ChainLayout,
  tailId: string,
  keys: CommittedKeys,
): string | undefined {
  const path = tailProofPath(layout, tailId);
  if (!existsSync(path)) return 'no tailproof.json';
  const owner = tailFingerprint(tailId);
  const key = keys(owner);
  if (key === null || key.fingerprint() !== owner) return 'no committed key for the tail';
  try {
    const proof = parseTailProof(decodeStoredBytes(readFileSync(path)).replace(/\n+$/, ''));
    const verdict = verifyTailProof({ proof, tail: tailId, publicKey: key.key });
    return verdict.ok ? undefined : verdict.reason;
  } catch (error) {
    return (error as Error).message;
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
      new RegExp(`^${escaped}\\.(\\d{6}|checkpoints)\\.jsonl\\.repair\\.\\d+$`),
    ),
    ...found(directory, /^\.(\d{6}|checkpoints)\.jsonl\.repair\.\d+$/),
  ];
  for (const path of staged) if (dead(path)) rmSync(path, { force: true });
}
