/**
 * What one signed checkpoint line proves, asked in one place by both readers of a tail: the
 * verdict (`verify.ts`, which rules on the whole record) and the read that serves it
 * ({@link foldCheckpoints}, which every surface asks through the projection).
 *
 * WHY ONE FUNCTION. The questions a line is asked (does it name this tail, does it link to the
 * line before, does it start where the coverage ends, is its key committed and the one its name
 * says, does its range fold to its root, does its signature hold, do the events of its range name
 * its signer) used to live in the verifier's loop alone, and a read served every event with no
 * question about any checkpoint: a tail rewritten and re-chained, with its checkpoints left as
 * they were, was served by every surface and governed the gate while `verify` refused it. Two
 * spellings of one rule is how one comes to be more lenient than the other, so the loop body
 * moved here unchanged, in the same order and with the same words, and each caller keeps only
 * its own policy: `verify` advances nothing past a line that fails, and the read measures the
 * next line against the stored hash of the failed one (ADR-558, ADR-560).
 *
 * WHAT IS NOT HERE: canonicalization, chaining and the signature of a checkpoint
 * (`checkpoint.ts`, FORMAT.md section 6), which nothing here changes; and the rules folded in
 * sections 6.1 to 6.11, which only `verify` asks.
 */

import type { KeyObject } from 'node:crypto';
import { oneLine } from '../one-line.js';
import {
  type Checkpoint,
  checkpointHash,
  checkpointSignatureHolds,
  verifyCheckpoint,
} from './checkpoint.js';
import type { ChainEntry } from './entry.js';
import { contentRoot, contentRootStart, contentRootStep } from './hash.js';
import type { WrittenHead } from './kept-head.js';
import { tailFingerprint } from './layout.js';
import type { CommittedKeys } from './store.js';

/** Which question a checkpoint line failed: the order is the order they are asked in. */
export type CheckpointFault =
  | 'another-tail'
  | 'prev'
  | 'coverage-gap'
  | 'no-key'
  | 'key-swapped'
  | 'no-range'
  | 'range-mismatch'
  | 'content-root-mismatch'
  | 'bad-signature'
  | 'event-signer'
  | 'tail-signer-mismatch';

/** One checkpoint line, and what the caller's policy says it must link to and start at. */
export interface CheckpointQuestion {
  readonly tail: string;
  readonly checkpoint: Checkpoint;
  /** What `prev` must name, as the caller's policy keeps it. */
  readonly prev: string | null;
  /** The seq `fromSeq` must be; undefined when no range can be known (a line of the tail did not read). */
  readonly from: number | undefined;
  /** The events of `[fromSeq..toSeq]` as the caller chose them; undefined when no range can be known. */
  readonly range: readonly ChainEntry[] | undefined;
  readonly keys: CommittedKeys;
  /**
   * `checked`: the line's own signature is verified. `bound-by-a-later-one`: it is not, because a
   * later line whose signature the caller does verify names this one through `prev` (the hash of
   * this line's signed message), so a forged signature here is a forged message there; only the
   * range and the root are asked.
   */
  readonly signature: 'checked' | 'bound-by-a-later-one';
}

/** What a line proves: it holds, or the first question it failed, in `verify`'s own words. */
export type CheckpointRuling =
  | { readonly holds: true; readonly hash: string }
  | {
      readonly holds: false;
      readonly hash: string;
      readonly fault: CheckpointFault;
      readonly seq: number | undefined;
      /** `verify`'s detail, byte for byte. */
      readonly detail: string;
    };

/** The questions of one checkpoint line, in `verify`'s order and with its words. */
export function ruleOnCheckpoint(question: CheckpointQuestion): CheckpointRuling {
  const { tail, checkpoint, prev, from, range, keys, signature } = question;
  const hash = checkpointHash(checkpoint);
  const fails = (fault: CheckpointFault, seq: number | undefined, detail: string) =>
    ({ holds: false, hash, fault, seq, detail }) as const;
  if (checkpoint.tail !== tail) {
    return fails(
      'another-tail',
      undefined,
      `checkpoint names tail ${oneLine(checkpoint.tail)}, stored under ${oneLine(tail)}`,
    );
  }
  // Checkpoint chain: each checkpoint links to the previous one's hash, so an EARLIER checkpoint
  // dropped under a later one breaks here.
  if (checkpoint.prev !== prev) {
    return fails(
      'prev',
      checkpoint.fromSeq,
      'checkpoint chain break: prev does not link to the previous checkpoint',
    );
  }
  if (from !== undefined && checkpoint.fromSeq !== from) {
    return fails(
      'coverage-gap',
      checkpoint.fromSeq,
      `checkpoint coverage gap: expected to start at ${from}, starts at ${checkpoint.fromSeq}`,
    );
  }
  const committed = keys(checkpoint.signerFp);
  if (committed === null) {
    return fails(
      'no-key',
      checkpoint.fromSeq,
      `no committed public key for signer ${oneLine(checkpoint.signerFp)}`,
    );
  }
  // Fingerprint binding: the file is NAMED by a fingerprint, but a forger can overwrite that file
  // with their own key. The loaded key's real fingerprint must equal the one the checkpoint names.
  if (committed.fingerprint() !== checkpoint.signerFp) {
    return fails(
      'key-swapped',
      checkpoint.fromSeq,
      `public key for ${oneLine(checkpoint.signerFp)} does not match its fingerprint (key was swapped)`,
    );
  }
  if (range === undefined) {
    if (signature === 'bound-by-a-later-one') {
      // No range can be known: the chain is not whole, and every signature answers it.
      return fails('no-range', undefined, 'no range to check the chain over');
    }
    if (!checkpointSignatureHolds(checkpoint, committed.key)) {
      return fails('bad-signature', checkpoint.fromSeq, 'checkpoint failed: bad-signature');
    }
    return { holds: true, hash };
  }
  const verdict = rangeVerdict(checkpoint, range, committed.key, signature);
  if (verdict !== undefined) return fails(verdict.fault, checkpoint.fromSeq, verdict.detail);
  // Signer binding: every event of the range names the signer that attested it, and its `which`,
  // when present, is not its `who` in the canonical form the gate compares them in.
  const bindingBreak = range.find(
    (e) =>
      e.event.signerFp !== checkpoint.signerFp ||
      (e.event.which !== undefined &&
        canonicalIdentityForm(e.event.which) === canonicalIdentityForm(e.event.who)),
  );
  if (bindingBreak !== undefined) {
    return fails(
      'event-signer',
      bindingBreak.link.seq,
      'event identity does not bind to its signer: signerFp disagrees with the checkpoint',
    );
  }
  return { holds: true, hash };
}

/**
 * The range and root half of a line, and its signature when it is `checked`. In the
 * `bound-by-a-later-one` mode a wrong count and a wrong root are one reason, `root`, which is
 * what `verify`'s chained pass always said of them: that pass is answered again with every
 * signature as soon as it finds anything, so its words never reach a verdict.
 */
function rangeVerdict(
  checkpoint: Checkpoint,
  range: readonly ChainEntry[],
  key: KeyObject,
  signature: CheckpointQuestion['signature'],
): { readonly fault: CheckpointFault; readonly detail: string } | undefined {
  // The signed root is folded over the events AS WRITTEN: over the lifted reading, the first
  // version bump would be a signature failure on every chain written before it.
  if (signature === 'checked') {
    const verdict = verifyCheckpoint({
      checkpoint,
      events: range.map((e) => e.written),
      publicKey: key,
    });
    return verdict.ok
      ? undefined
      : { fault: verdict.reason, detail: `checkpoint failed: ${verdict.reason}` };
  }
  const whole =
    range.length === checkpoint.toSeq - checkpoint.fromSeq + 1 &&
    contentRoot(range.map((e) => e.written)) === checkpoint.contentRoot;
  return whole ? undefined : { fault: 'content-root-mismatch', detail: 'checkpoint failed: root' };
}

/**
 * The canonical form of an identity for the who-vs-which comparison: NFC then trim, the SAME
 * normalization the core's gate applies before it refuses a self-authorizing move. Never used to
 * rewrite the signed bytes.
 */
export function canonicalIdentityForm(value: string): string {
  return value.normalize('NFC').trim();
}

/**
 * The name both readers refuse a write into another key's tail by (FORMAT.md section 6). It is
 * not `signer-mismatch`, which is the tail proof's (section 6.1).
 */
export const TAIL_SIGNER_MISMATCH = 'tail-signer-mismatch';

/** Whether a checkpoint is signed by the key its tail's id begins with (FORMAT.md section 6). */
export function checkpointBelongsToItsTail(tail: string, checkpoint: Checkpoint): boolean {
  return checkpoint.signerFp === tailFingerprint(tail);
}

/** `verify`'s sentence for a checkpoint signed by a key other than its tail's. */
export function checkpointOfAnotherKeySentence(tail: string, checkpoint: Checkpoint): string {
  return `checkpoint cp[${checkpoint.fromSeq}..${checkpoint.toSeq}] is signed by ${oneLine(checkpoint.signerFp.slice(0, 12))}..., and a tail is written only by the key its id begins with, ${oneLine(tailFingerprint(tail).slice(0, 12))}... (${TAIL_SIGNER_MISMATCH})`;
}

// ------------------------------------------------------------------------------------------------
// The read's fold
// ------------------------------------------------------------------------------------------------

/** Why a run of a tail was not served. */
export type Withheld =
  | 'checkpoint'
  | 'with-a-break'
  | 'missing-signed'
  | 'checkpoints-removed'
  | 'unproven-beyond-one-write'
  | 'no-checkpoint';

/** A run of a tail withheld from what is served, and why. */
export interface WithheldRun {
  readonly fromSeq: number;
  readonly toSeq: number;
  readonly why: Withheld;
  /** The checkpoints.jsonl line (counted from 1) whose range this is, when a line names it. */
  readonly line?: number;
  /** The fault of that line, in `verify`'s words, when it failed one of its questions. */
  readonly fault?: CheckpointFault;
  readonly detail?: string;
  /** For `missing-signed`: the first seq of the range the tail does not hold. */
  readonly missing?: number;
  /** For `checkpoints-removed`: the hash of the checkpoint the signed note names. */
  readonly noteCheckpoint?: string;
}

/** What the read learnt of one tail's checkpoints. */
export interface TailSigned {
  readonly tail: string;
  /** The last seq of the run of holding lines from seq 0; -1 for none. */
  readonly signedTo: number;
  /** The highest `toSeq` any line names, held or not; -1 for none. */
  readonly namedTo: number;
  /** How many lines the file held, and how many of them failed. */
  readonly lines: number;
  readonly failedLines: number;
  /** The runs withheld, Fact A, each of which denies a write. */
  readonly withheld: readonly WithheldRun[];
  /** The runs proven, by a checkpoint that holds or by this machine's signed note. */
  readonly proven: readonly {
    readonly fromSeq: number;
    readonly toSeq: number;
    readonly by: 'checkpoint' | 'note';
  }[];
  /**
   * The run served and never governing: at most one write's window at the tail's end, which
   * the guard allows (Fact B). Absent when there is none.
   */
  readonly unproven?: { readonly fromSeq: number; readonly toSeq: number; readonly count: number };
  /** The entry hashes the projection may fold: those proven. */
  readonly provenHashes: ReadonlySet<string>;
}

/** What {@link foldCheckpoints} is asked over. */
export interface FoldQuestion {
  readonly tail: string;
  /** EVERY line of the tail that parsed, the retained ones included, in stored order. */
  readonly entries: readonly ChainEntry[];
  readonly checkpoints: readonly Checkpoint[];
  readonly keys: CommittedKeys;
  /** The seqs of a standing fact of the tail: a link break, an altered entry. */
  readonly standing: ReadonlySet<number>;
  /** This machine's signed note of the tail, verified with the key this machine holds. */
  readonly note?: WrittenHead;
  /** The most events one write leaves above the coverage (`DEFAULT_MAX_UNSIGNED_EVENTS`). */
  readonly window: number;
  /** Counts each event folded into a root while a range is searched: for the cost test. */
  readonly onFold?: () => void;
}

/**
 * Folds a tail's checkpoints over its events and says which events are proven, which are
 * withheld (Fact A) and which are the one write's window served and not governing (Fact B).
 *
 * Signatures (ADR-557): the last line's alone, every earlier one bound to it through `prev`; on
 * any failure every signature is checked, to name the first that fails.
 */
export function foldCheckpoints(question: FoldQuestion): TailSigned {
  const chained = foldOnce(question, 'the-last');
  if (chained.failedLines === 0) return chained;
  return foldOnce(question, 'every');
}

/** The entries of a tail, distinct by hash, by seq and by `prev`: what a range is chosen from. */
interface Index {
  readonly bySeq: ReadonlyMap<number, readonly ChainEntry[]>;
  readonly children: ReadonlyMap<string, readonly ChainEntry[]>;
}

function indexOf(entries: readonly ChainEntry[]): Index {
  const bySeq = new Map<number, ChainEntry[]>();
  const children = new Map<string, ChainEntry[]>();
  const seen = new Set<string>();
  for (const entry of entries) {
    // The same bytes stored twice are ONE entry (a merge that duplicated a line rewrote nothing).
    if (seen.has(entry.link.hash)) continue;
    seen.add(entry.link.hash);
    const at = bySeq.get(entry.link.seq);
    if (at === undefined) bySeq.set(entry.link.seq, [entry]);
    else at.push(entry);
    if (entry.link.prev !== null) {
      const below = children.get(entry.link.prev);
      if (below === undefined) children.set(entry.link.prev, [entry]);
      else below.push(entry);
    }
  }
  return { bySeq, children };
}

/**
 * The events a line covers, chosen by chaining and never by slicing: from each candidate at
 * `fromSeq`, the paths that follow `prev` up to `toSeq`, the root folded along the path with the
 * accumulator shared by a common prefix. The path whose root is the line's is the branch the
 * signatures follow; with none, the first complete path (or the longest run) is what the ruling
 * names the fault of. Each entry has one `prev`, so the paths of one line are disjoint below their
 * candidates and every entry is folded at most once per line.
 */
function rangeOf(
  index: Index,
  checkpoint: Checkpoint,
  candidates: readonly ChainEntry[],
  onFold: (() => void) | undefined,
): readonly ChainEntry[] {
  const length = checkpoint.toSeq - checkpoint.fromSeq + 1;
  let fallback: readonly ChainEntry[] = [];
  if (length <= 0) return fallback;
  for (const candidate of candidates) {
    const path: ChainEntry[] = [];
    const roots: Buffer[] = [];
    const stack: { entry: ChainEntry; depth: number }[] = [{ entry: candidate, depth: 0 }];
    while (stack.length > 0) {
      const { entry, depth } = stack.pop() as { entry: ChainEntry; depth: number };
      path.length = depth;
      roots.length = depth;
      path.push(entry);
      onFold?.();
      const root = contentRootStep(
        depth === 0 ? contentRootStart() : (roots[depth - 1] as Buffer),
        entry.written,
      );
      roots.push(root);
      if (path.length === length) {
        if (root.toString('hex') === checkpoint.contentRoot) return [...path];
        if (fallback.length < length) fallback = [...path];
        continue;
      }
      if (path.length > fallback.length) fallback = [...path];
      const next = (index.children.get(entry.link.hash) ?? []).filter(
        (child) => child.link.seq === entry.link.seq + 1,
      );
      // Pushed in reverse so the first stored child is searched first: the tie goes to the path
      // whose entries come first in the segment files.
      for (let i = next.length - 1; i >= 0; i -= 1) {
        stack.push({ entry: next[i] as ChainEntry, depth: depth + 1 });
      }
    }
  }
  return fallback;
}

function foldOnce(question: FoldQuestion, signatures: 'the-last' | 'every'): TailSigned {
  const { tail, checkpoints, keys, standing, entries } = question;
  const index = indexOf(entries);
  const withheld: WithheldRun[] = [];
  const proven: { fromSeq: number; toSeq: number; by: 'checkpoint' | 'note' }[] = [];
  const provenHashes = new Set<string>();
  let expectedPrev: string | null = null;
  let covered = -1;
  let signedTo = -1;
  let namedTo = -1;
  let failedLines = 0;
  // The entry the last holding range ended on: where the next range has to chain from.
  let anchor: ChainEntry | null | undefined = null;
  checkpoints.forEach((checkpoint, at) => {
    const line = at + 1;
    namedTo = Math.max(namedTo, checkpoint.toSeq);
    // After a holding line, the range chains on from the entry that line's range ended on. After
    // a failed one there is no such entry to chain from (it may be the very line that is gone), so
    // every entry at the line's first seq is a candidate, and the root says which one it signed.
    const atFrom = index.bySeq.get(checkpoint.fromSeq) ?? [];
    const after = anchor === undefined ? undefined : anchor === null ? null : anchor.link.hash;
    const candidates =
      after === undefined ? atFrom : atFrom.filter((entry) => entry.link.prev === after);
    const range = rangeOf(index, checkpoint, candidates, question.onFold);
    const last = at === checkpoints.length - 1;
    const ruled = ruleOnCheckpoint({
      tail,
      checkpoint,
      prev: expectedPrev,
      from: covered + 1,
      range,
      keys,
      signature: signatures === 'every' || last ? 'checked' : 'bound-by-a-later-one',
    });
    const ruling: CheckpointRuling =
      ruled.holds && !checkpointBelongsToItsTail(tail, checkpoint)
        ? {
            holds: false,
            hash: ruled.hash,
            fault: 'tail-signer-mismatch',
            seq: checkpoint.fromSeq,
            detail: checkpointOfAnotherKeySentence(tail, checkpoint),
          }
        : ruled;
    if (ruling.holds) {
      proven.push({ fromSeq: checkpoint.fromSeq, toSeq: checkpoint.toSeq, by: 'checkpoint' });
      for (const entry of range) provenHashes.add(entry.link.hash);
      if (failedLines === 0) signedTo = checkpoint.toSeq;
      anchor = range[range.length - 1] ?? anchor;
    } else {
      failedLines += 1;
      withheld.push(withheldRun(index, standing, checkpoint, line, ruling));
      // The next line is measured as level 1 measures the next entry: against what this one
      // STORES, its hash and the seq after its range (ADR-560).
      anchor = undefined;
    }
    expectedPrev = ruling.hash;
    covered = checkpoint.toSeq;
  });
  return withTheRest(question, {
    tail,
    signedTo,
    namedTo,
    lines: checkpoints.length,
    failedLines,
    withheld,
    proven,
    provenHashes,
  });
}

/** Where a range that does not hold is, by the fact it touches (ADR-558, ADR-562). */
function withheldRun(
  index: Index,
  standing: ReadonlySet<number>,
  checkpoint: Checkpoint,
  line: number,
  ruling: Extract<CheckpointRuling, { holds: false }>,
): WithheldRun {
  const base = {
    fromSeq: checkpoint.fromSeq,
    toSeq: checkpoint.toSeq,
    line,
    fault: ruling.fault,
    detail: ruling.detail,
  };
  for (let seq = checkpoint.fromSeq; seq <= checkpoint.toSeq; seq += 1) {
    if (!index.bySeq.has(seq)) return { ...base, why: 'missing-signed', missing: seq };
  }
  for (let seq = checkpoint.fromSeq; seq <= checkpoint.toSeq; seq += 1) {
    if (standing.has(seq) || (index.bySeq.get(seq)?.length ?? 0) > 1) {
      return { ...base, why: 'with-a-break' };
    }
  }
  return { ...base, why: 'checkpoint' };
}

/**
 * What the lines leave: the events neither proven nor withheld. This machine's signed note proves
 * the ones it vouches for (ADR-560); the rest are one write's window when the guard allows it
 * (ADR-561) and withheld otherwise.
 */
function withTheRest(
  question: FoldQuestion,
  folded: Omit<TailSigned, 'unproven'> & { readonly provenHashes: Set<string> },
): TailSigned {
  const { entries, note, window } = question;
  const withheld = [...folded.withheld];
  const proven = [...folded.proven];
  const provenHashes = folded.provenHashes;
  const inWithheld = (seq: number): boolean =>
    withheld.some((run) => seq >= run.fromSeq && seq <= run.toSeq);
  const seen = new Set<string>();
  let rest = entries
    .filter((entry) => {
      if (seen.has(entry.link.hash)) return false;
      seen.add(entry.link.hash);
      return !provenHashes.has(entry.link.hash) && !inWithheld(entry.link.seq);
    })
    .sort((a, b) => a.link.seq - b.link.seq);

  // The signed note: the events this machine wrote and signed, or is writing now, past the
  // signed prefix, are proven by it when the tail still holds them as the note names them. And a
  // note that names a checkpoint the file no longer holds, above what the file proves, is the
  // proof of a cut (ADR-560), whether the events went with it or were rewritten in its place.
  if (note !== undefined) {
    const vouched = rest.length === 0 ? [] : vouchedByTheNote(rest, folded.signedTo, note);
    const cut =
      note.coveredThrough > folded.signedTo &&
      folded.failedLines === 0 &&
      (rest.some((entry) => entry.link.seq <= note.coveredThrough) ||
        (note.checkpoint !== null &&
          !question.checkpoints.some((line) => checkpointHash(line) === note.checkpoint)));
    if (vouched.length > 0) {
      for (const entry of vouched) provenHashes.add(entry.link.hash);
      proven.push({
        fromSeq: (vouched[0] as ChainEntry).link.seq,
        toSeq: (vouched[vouched.length - 1] as ChainEntry).link.seq,
        by: 'note',
      });
      rest = rest.filter((entry) => !provenHashes.has(entry.link.hash));
    } else if (cut) {
      // The note says checkpoints up to `coveredThrough` were signed here, and the tail no longer
      // holds what they covered as the note names it: they were removed with what they signed.
      withheld.push({
        fromSeq: folded.signedTo + 1,
        toSeq: note.coveredThrough,
        why: 'checkpoints-removed',
        ...(note.checkpoint !== null ? { noteCheckpoint: note.checkpoint } : {}),
      });
      rest = rest.filter((entry) => entry.link.seq > note.coveredThrough);
    }
  }
  if (rest.length === 0) return { ...folded, withheld, proven, provenHashes };

  const fromSeq = (rest[0] as ChainEntry).link.seq;
  const toSeq = (rest[rest.length - 1] as ChainEntry).link.seq;
  const holding = folded.proven.some((run) => run.by === 'checkpoint');
  // The run goes on from the last proven entry: a branch that forks below it is not one write.
  const tip = entries.find(
    (entry) => entry.link.seq === folded.signedTo && provenHashes.has(entry.link.hash),
  );
  const atTheEnd =
    fromSeq === folded.signedTo + 1 &&
    folded.namedTo === folded.signedTo &&
    toSeq - fromSeq + 1 === rest.length &&
    (rest[0] as ChainEntry).link.prev === (tip?.link.hash ?? null) &&
    rest.every((entry, i) => i === 0 || entry.link.prev === (rest[i - 1] as ChainEntry).link.hash);
  if (holding && atTheEnd && rest.length <= window) {
    return {
      ...folded,
      withheld,
      proven,
      provenHashes,
      unproven: { fromSeq, toSeq, count: rest.length },
    };
  }
  withheld.push({
    fromSeq,
    toSeq,
    why: holding ? 'unproven-beyond-one-write' : 'no-checkpoint',
  });
  return { ...folded, withheld, proven, provenHashes };
}

/**
 * The events past the signed prefix that this machine's note vouches for: the run from
 * `signedTo + 1` that chains up to the entry the note names (its end, or the end its pending
 * append names), with that entry's hash. Empty when the tail does not hold that run.
 */
function vouchedByTheNote(
  rest: readonly ChainEntry[],
  signedTo: number,
  note: WrittenHead,
): readonly ChainEntry[] {
  const ends = [
    note.next,
    note.seq >= 0 && note.hash !== null ? { seq: note.seq, hash: note.hash } : null,
  ]
    .filter((end): end is { seq: number; hash: string } => end !== null)
    .filter((end) => end.seq > signedTo);
  for (const end of ends) {
    const byHash = new Map(rest.map((entry) => [entry.link.hash, entry]));
    const run: ChainEntry[] = [];
    let at = byHash.get(end.hash);
    while (at !== undefined && at.link.seq > signedTo) {
      run.unshift(at);
      at = at.link.prev === null ? undefined : byHash.get(at.link.prev);
    }
    const first = run[0];
    if (
      first !== undefined &&
      first.link.seq === signedTo + 1 &&
      run.length === end.seq - signedTo
    ) {
      return run;
    }
  }
  return [];
}
