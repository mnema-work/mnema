/**
 * WHAT A WHOLE PUBLIC TAIL IS PUT BACK AS, when its lines all hold and its signed checkpoints do not
 * (ADR-559, ADR-563). The reading and the writing are `tail-repair.ts`; this decides, over what was
 * read, and writes nothing.
 *
 * THE REVISION PROVES ITSELF FIRST: its events chain from seq 0 with every hash holding, and its
 * checkpoints fold over them with every signature checked, under the keys the working tree holds.
 *
 * THEN ONLY WHAT IS PROVEN IS KEPT ABOVE IT: an event of the working tail past what the revision's
 * signatures cover stays when a working checkpoint line that holds, folded on from the revision's
 * last one, covers it, or when this machine's signed note vouches for it. Everything else is
 * removed (the caller keeps it aside). A checkpoint's root is over the events' bytes, order and
 * count only (FORMAT.md section 5), so an honest event a forger re-chained still folds to the root
 * that signed it: it is kept, and its link computed again onto the tail it is put back on, which
 * gives back the bytes the forger replaced. The link is keyless (FORMAT.md section 3); nothing here
 * signs.
 *
 * THE RESULT IS FOLDED AGAIN before anything is written, and has to hold with no withheld run.
 */

import { type Checkpoint, checkpointHash } from './checkpoint.js';
import {
  checkpointBelongsToItsTail,
  foldCheckpoints,
  ruleOnCheckpoint,
} from './checkpoint-ruling.js';
import { type ChainEntry, entryHashHolds, serializeEntry } from './entry.js';
import { contentRoot, entryHash, eventBytes } from './hash.js';
import type { WrittenHead } from './kept-head.js';
import type { CommittedKeys } from './store.js';

/** An event of a tail, the segment it sits in, and its stored line. */
export interface StoredEvent {
  readonly entry: ChainEntry;
  readonly segment: string;
  readonly bytes: Uint8Array;
}

/** A checkpoint line and its stored bytes. */
export interface StoredCheckpoint {
  readonly checkpoint: Checkpoint;
  readonly bytes: Uint8Array;
}

/** A run of consecutive seqs. */
export interface SeqRun {
  readonly from: number;
  readonly to: number;
}

/** Why a whole tail was not put back. */
export type WholeTailRefusal =
  /** The revision holds no event of the tail. */
  | { readonly reason: 'NOT_IN_REVISION' }
  /** A file of the revision does not prove itself: the line, and the question it failed. */
  | {
      readonly reason: 'REVISION_DOES_NOT_HOLD';
      readonly file: string;
      readonly line?: number;
      readonly fault: string;
    }
  /** The working `tailproof.json` does not verify under the tail's committed key. */
  | { readonly reason: 'TAILPROOF_DOES_NOT_HOLD'; readonly fault: string }
  /** A line of the working `checkpoints.jsonl` is a conflict marker git left. */
  | { readonly reason: 'CONFLICT_MARKS'; readonly file: string; readonly line: number }
  /** This machine's signed note names an event or a checkpoint the result would not hold. */
  | { readonly reason: 'REVISION_BEHIND_THE_NOTE'; readonly seq: number }
  /** The result, folded again, still has a run withheld: a stop, nothing written. */
  | { readonly reason: 'DOES_NOT_HOLD_AFTER'; readonly fault: string };

/** The tail as it is to be left. */
export interface WholeTailPlan {
  /** Every event of the result, in seq order, with the segment it goes in. */
  readonly entries: readonly StoredEvent[];
  readonly checkpoints: readonly StoredCheckpoint[];
  /** The events past what the revision's signatures cover that a signature or the note proves. */
  readonly keptAbove: readonly SeqRun[];
  /** The events of the working tail that nothing proves, by seq: not in the result. */
  readonly removed: readonly SeqRun[];
  /** The events whose link was computed again: their content as signed, re-chained by someone. */
  readonly relinked: readonly SeqRun[];
}

/** What the plan is asked over. */
export interface WholeTailQuestion {
  readonly tail: string;
  /** Every event of the working tail that reads and holds its hash, in stored order. */
  readonly working: readonly StoredEvent[];
  readonly workingCheckpoints: readonly StoredCheckpoint[];
  /** The revision's events in stored order; its segments sorted by name. */
  readonly revision: readonly StoredEvent[];
  readonly revisionCheckpoints: readonly StoredCheckpoint[];
  readonly keys: CommittedKeys;
  /** This machine's signed note of the tail, verified with the tail's committed key. */
  readonly note?: WrittenHead;
  readonly window: number;
}

/**
 * Whether a tail whose lines all hold needs the whole of it put back: a run its checkpoints
 * withhold (a fact that denies, a signed event gone included), a `checkpoints.jsonl` line that does
 * not read, a checkpoint this machine's note cites and the file does not hold, or events no signature proves that the revision does not hold either (what was added
 * after it; a write's window that git committed is the writer's to sign, and is left).
 */
export function theWholeTailIsNeeded(question: {
  readonly tail: string;
  readonly entries: readonly ChainEntry[];
  readonly checkpoints: readonly Checkpoint[];
  readonly checkpointsRead: boolean;
  readonly keys: CommittedKeys;
  readonly note?: WrittenHead;
  readonly window: number;
  /** The entry hashes the revision holds. */
  readonly revision: ReadonlySet<string>;
}): boolean {
  if (!question.checkpointsRead) return true;
  // The note cites a checkpoint the file no longer holds: checkpoints were taken out, even where
  // the note still vouches for every event (ADR-560).
  const { note } = question;
  if (
    note !== undefined &&
    note.checkpoint !== null &&
    !question.checkpoints.some((checkpoint) => checkpointHash(checkpoint) === note.checkpoint)
  ) {
    return true;
  }
  const folded = foldCheckpoints({
    tail: question.tail,
    entries: question.entries,
    checkpoints: question.checkpoints,
    keys: question.keys,
    standing: new Set(),
    window: question.window,
    ...(question.note !== undefined ? { note: question.note } : {}),
  });
  if (folded.withheld.length > 0) return true;
  const unproven = folded.unproven;
  if (unproven === undefined) return false;
  return question.entries.some(
    (entry) =>
      entry.link.seq >= unproven.fromSeq &&
      !folded.provenHashes.has(entry.link.hash) &&
      !question.revision.has(entry.link.hash),
  );
}

/** The tail to be left, or why none is: decided over what was read, before any byte is written. */
export function planWholeTail(
  question: WholeTailQuestion,
):
  | { readonly ok: true; readonly plan: WholeTailPlan }
  | { readonly ok: false; readonly refusal: WholeTailRefusal } {
  const { tail, keys, note, window } = question;
  const refused = (refusal: WholeTailRefusal) => ({ ok: false, refusal }) as const;
  if (question.revision.length === 0) return refused({ reason: 'NOT_IN_REVISION' });

  // The revision's events: whole, chained from seq 0, each holding its hash.
  let previous: ChainEntry | undefined;
  const lineOf = new Map<string, number>();
  for (const one of question.revision) {
    const line = (lineOf.get(one.segment) ?? 0) + 1;
    lineOf.set(one.segment, line);
    const { link } = one.entry;
    const fault = !entryHashHolds(one.entry)
      ? 'the hash does not hold'
      : link.tail !== tail
        ? 'another tail'
        : link.seq !== (previous?.link.seq ?? -1) + 1
          ? 'not the next seq'
          : link.prev !== (previous?.link.hash ?? null)
            ? 'does not chain to the line before'
            : undefined;
    if (fault !== undefined) {
      return refused({ reason: 'REVISION_DOES_NOT_HOLD', file: one.segment, line, fault });
    }
    previous = one.entry;
  }
  const revisionFolded = foldCheckpoints({
    tail,
    entries: question.revision.map((one) => one.entry),
    checkpoints: question.revisionCheckpoints.map((one) => one.checkpoint),
    keys,
    standing: new Set(),
    window,
    signatures: 'every',
  });
  const [first] = revisionFolded.withheld;
  if (first !== undefined) {
    return refused({
      reason: 'REVISION_DOES_NOT_HOLD',
      file: 'checkpoints.jsonl',
      ...(first.line !== undefined ? { line: first.line } : {}),
      fault: first.fault ?? first.why,
    });
  }

  // What the revision's signatures prove is the base; above it, only what is proven again.
  const signedTo = revisionFolded.signedTo;
  const result: StoredEvent[] = question.revision.filter((one) => one.entry.link.seq <= signedTo);
  const checkpoints: StoredCheckpoint[] = [...question.revisionCheckpoints];
  const relinked: number[] = [];
  const pool = new Map<string, StoredEvent>();
  for (const one of [...question.working, ...question.revision]) {
    if (one.entry.link.seq > signedTo && !pool.has(one.entry.link.hash)) {
      pool.set(one.entry.link.hash, one);
    }
  }
  const above = [...pool.values()];
  let end = signedTo;
  let tip: string | null = result[result.length - 1]?.entry.link.hash ?? null;
  let checkpointPrev: string | null =
    checkpoints.length === 0
      ? null
      : checkpointHash((checkpoints[checkpoints.length - 1] as StoredCheckpoint).checkpoint);
  const take = (run: readonly StoredEvent[]): void => {
    for (const one of chainedOnto(run, tip)) {
      if (one.relinked) relinked.push(one.event.entry.link.seq);
      result.push(one.event);
      tip = one.event.entry.link.hash;
      end = one.event.entry.link.seq;
    }
  };

  // The working checkpoint lines that fold on from the revision's last one, each over the events
  // its root names, whatever links a forger gave them.
  for (;;) {
    const next = question.workingCheckpoints.find((one) => {
      const { checkpoint } = one;
      if (checkpoint.prev !== checkpointPrev || checkpoint.fromSeq !== end + 1) return false;
      if (!checkpointBelongsToItsTail(tail, checkpoint)) return false;
      const range = rangeSignedBy(above, checkpoint, tip);
      if (range === undefined) return false;
      return ruleOnCheckpoint({
        tail,
        checkpoint,
        prev: checkpointPrev,
        from: end + 1,
        range: range.map((event) => event.entry),
        keys,
        signature: 'checked',
      }).holds;
    });
    if (next === undefined) break;
    take(rangeSignedBy(above, next.checkpoint, tip) as readonly StoredEvent[]);
    checkpoints.push(next);
    checkpointPrev = checkpointHash(next.checkpoint);
  }

  // The events this machine's signed note vouches for past the last checkpoint.
  if (note !== undefined) {
    const ends = [
      note.next,
      note.seq >= 0 && note.hash !== null ? { seq: note.seq, hash: note.hash } : null,
    ]
      .filter((one): one is { seq: number; hash: string } => one !== null)
      .filter((one) => one.seq > end);
    for (const named of ends) {
      const run = vouchedRun(above, end, tip, named);
      if (run !== undefined) {
        take(run);
        break;
      }
    }
    const reaches =
      note.seq < 0 ||
      [note.next, { seq: note.seq, hash: note.hash }].some(
        (named) =>
          named !== null &&
          result.some(
            (one) => one.entry.link.seq === named.seq && one.entry.link.hash === named.hash,
          ),
      );
    const cites =
      note.checkpoint === null ||
      checkpoints.some((one) => checkpointHash(one.checkpoint) === note.checkpoint);
    if (!reaches) return refused({ reason: 'REVISION_BEHIND_THE_NOTE', seq: note.seq });
    if (!cites) return refused({ reason: 'REVISION_BEHIND_THE_NOTE', seq: note.coveredThrough });
  }

  const after = foldCheckpoints({
    tail,
    entries: result.map((one) => one.entry),
    checkpoints: checkpoints.map((one) => one.checkpoint),
    keys,
    standing: new Set(),
    window,
    signatures: 'every',
    ...(note !== undefined ? { note } : {}),
  });
  const still = after.withheld[0];
  if (still !== undefined || after.unproven !== undefined) {
    return refused({
      reason: 'DOES_NOT_HOLD_AFTER',
      fault: still?.fault ?? still?.why ?? 'unproven',
    });
  }

  const kept = new Set(result.map((one) => `${one.entry.link.seq}:${contentOf(one.entry)}`));
  const removed = question.working
    .filter((one) => !kept.has(`${one.entry.link.seq}:${contentOf(one.entry)}`))
    .map((one) => one.entry.link.seq);
  return {
    ok: true,
    plan: {
      entries: result,
      checkpoints,
      keptAbove: runsOf(
        result.filter((one) => one.entry.link.seq > signedTo).map((one) => one.entry.link.seq),
      ),
      removed: runsOf(removed),
      relinked: runsOf(relinked),
    },
  };
}

/** The bytes of an event's content, as text: what a root folds and a link does not. */
function contentOf(entry: ChainEntry): string {
  return Buffer.from(eventBytes(entry.written)).toString('hex');
}

/**
 * The events a checkpoint line signs among `events`, by seq from its `fromSeq` to its `toSeq`: when
 * each seq holds one content, that one, whatever its link says (a forger re-chains links, and a
 * root is over contents); when a seq holds two, the stored links are followed from each event at
 * `fromSeq`, and the path whose contents fold to the line's root is the one.
 */
function rangeSignedBy(
  events: readonly StoredEvent[],
  checkpoint: Checkpoint,
  tip: string | null,
): readonly StoredEvent[] | undefined {
  const bySeq = new Map<number, StoredEvent[]>();
  for (const one of events) {
    const seq = one.entry.link.seq;
    if (seq < checkpoint.fromSeq || seq > checkpoint.toSeq) continue;
    const at = bySeq.get(seq) ?? [];
    if (!at.some((other) => contentOf(other.entry) === contentOf(one.entry))) at.push(one);
    bySeq.set(seq, at);
  }
  const plain: StoredEvent[] = [];
  for (let seq = checkpoint.fromSeq; seq <= checkpoint.toSeq; seq += 1) {
    const at = bySeq.get(seq);
    if (at === undefined) return undefined;
    if (at.length !== 1) return pathSignedBy(events, checkpoint, tip);
    plain.push(at[0] as StoredEvent);
  }
  return plain;
}

/** A fork: the stored path from `fromSeq` to `toSeq` whose contents fold to the line's root. */
function pathSignedBy(
  events: readonly StoredEvent[],
  checkpoint: Checkpoint,
  tip: string | null,
): readonly StoredEvent[] | undefined {
  const children = new Map<string | null, StoredEvent[]>();
  for (const one of events) {
    const below = children.get(one.entry.link.prev) ?? [];
    below.push(one);
    children.set(one.entry.link.prev, below);
  }
  const length = checkpoint.toSeq - checkpoint.fromSeq + 1;
  const starts = events.filter(
    (one) =>
      one.entry.link.seq === checkpoint.fromSeq && (tip === null || one.entry.link.prev === tip),
  );
  const fromAny =
    starts.length > 0 ? starts : events.filter((one) => one.entry.link.seq === checkpoint.fromSeq);
  const stack: StoredEvent[][] = fromAny.map((one) => [one]);
  while (stack.length > 0) {
    const path = stack.pop() as StoredEvent[];
    if (path.length === length) {
      if (contentRoot(path.map((one) => one.entry.written)) === checkpoint.contentRoot) return path;
      continue;
    }
    const at = path[path.length - 1] as StoredEvent;
    for (const child of children.get(at.entry.link.hash) ?? []) {
      if (child.entry.link.seq === at.entry.link.seq + 1) stack.push([...path, child]);
    }
  }
  return undefined;
}

/**
 * The run from `end + 1` up to the event the note names: by the stored links when they lead
 * there from `tip`, or, when each seq holds one content, the links computed again onto `tip` giving
 * the hash the note names.
 */
function vouchedRun(
  events: readonly StoredEvent[],
  end: number,
  tip: string | null,
  named: { readonly seq: number; readonly hash: string },
): readonly StoredEvent[] | undefined {
  const byHash = new Map(events.map((one) => [one.entry.link.hash, one]));
  const stored: StoredEvent[] = [];
  let at = byHash.get(named.hash);
  while (at !== undefined && at.entry.link.seq > end) {
    stored.unshift(at);
    at = at.entry.link.prev === null ? undefined : byHash.get(at.entry.link.prev);
  }
  if (
    stored.length === named.seq - end &&
    (stored[0] as StoredEvent | undefined)?.entry.link.prev === tip
  ) {
    return stored;
  }
  const run = rangeSignedBy(events, { fromSeq: end + 1, toSeq: named.seq } as Checkpoint, tip);
  if (run === undefined || run.length !== named.seq - end) return undefined;
  const chained = chainedOnto(run, tip);
  return chained[chained.length - 1]?.event.entry.link.hash === named.hash ? run : undefined;
}

/** The events with their links computed again in order onto `tip`: `seq` stays, `prev` and `hash` follow. */
function chainedOnto(
  run: readonly StoredEvent[],
  tip: string | null,
): { readonly event: StoredEvent; readonly relinked: boolean }[] {
  let prev = tip;
  return run.map((one) => {
    const { entry } = one;
    const hash = entryHash({
      event: entry.written,
      tail: entry.link.tail,
      seq: entry.link.seq,
      prev,
    });
    const same = entry.link.prev === prev && entry.link.hash === hash;
    const link = { ...entry.link, prev, hash };
    prev = hash;
    if (same) return { event: one, relinked: false };
    const again = { ...entry, link } as ChainEntry;
    return {
      event: {
        entry: again,
        segment: one.segment,
        bytes: Buffer.from(serializeEntry(again), 'utf-8'),
      },
      relinked: true,
    };
  });
}

/** Seqs as runs of consecutive ones, each seq once. */
function runsOf(seqs: readonly number[]): SeqRun[] {
  const sorted = [...new Set(seqs)].sort((a, b) => a - b);
  const runs: { from: number; to: number }[] = [];
  for (const seq of sorted) {
    const last = runs[runs.length - 1];
    if (last !== undefined && last.to === seq - 1) last.to = seq;
    else runs.push({ from: seq, to: seq });
  }
  return runs;
}
