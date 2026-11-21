/**
 * The append-only writer for one machine's tail.
 *
 * A writer owns exactly one tail: it appends events as sealed entries, chains
 * each to its predecessor, seals a segment once it passes the size cap, and signs a
 * checkpoint when the caller asks or when one act of writing has left too many
 * events unsigned.
 *
 * THE PREMISE THIS FILE HELD, AND WHAT FALSIFIED IT. It said: "Because each machine
 * writes only its own tail, there is never an in-file merge; concurrency across
 * machines is resolved by reading many tails, not by locking one file." The first
 * half is still true and the conclusion was still wrong, because the sentence
 * reasons about MACHINES and the danger is between PROCESSES. Two sessions on one
 * machine in one project share the identity, so they share the installation id, so
 * they share the tail: they are not two machines, they are two writers of one file,
 * and "each machine writes only its own tail" never said anything about them. What
 * falsified it is a measurement rather than an argument: two concurrent
 * `mnema decision` runs corrupted the chain in 15 of 20 rounds, and two MCP sessions
 * calling `record_observation` did the same, which is the plugin with two windows of
 * the host open on one project. So a tail IS locked now, for the window between
 * reading its end and appending to it; `tail-lock.ts` holds the mechanism and the
 * reasoning, and {@link ChainWriter.underTailLock} is the single door every write
 * here goes through.
 *
 * WHO DECIDES WHEN IT SIGNS. The writer holds a CEILING and nothing more (see
 * {@link DEFAULT_MAX_UNSIGNED_EVENTS}); the CADENCE belongs to the writing paths,
 * which sign what they wrote before they return. Reading `checkpoint()` as a knob
 * the writer turns on a schedule is the misreading this file corrected.
 *
 * The tail id pairs the signing key's fingerprint with this installation's id,
 * `<fingerprint>-<installationId>`. WHICH key signs (the signer fingerprint)
 * comes from the key; WHO the writer speaks for (the anchor) is read from local
 * material: the anchor this installation founded (its own) or enrolled into
 * (another key's), or, until one is recorded, the anchor it will found. Recording
 * that anchor and emitting the founding is the identity operation's job, not the
 * writer's; the writer only exposes the material (`anchor`, `hasAnchor`,
 * `recordAnchor`) so that operation can found a fresh installation before its
 * first fact.
 *
 * State (head hash, next seq, current segment, and the events no checkpoint
 * covers yet) is recovered from the END of the tail by the writer's first act, under
 * the lock, so a fresh process continues an existing tail correctly without re-reading
 * its history. (This said "on construction", which stopped being true when recovery
 * moved under the lock: see the constructor.) It is recovered AGAIN, under the lock,
 * whenever the tail's files turn out to have moved since this writer last looked,
 * which is what makes the held state safe to keep between appends instead of being
 * re-read on every one. See {@link ChainWriter.mark}.
 *
 * A writer that is opened and never appends leaves nothing a clone receives: the tail
 * is BORN at the first append ({@link ChainWriter.ensureBorn}), not when it is opened.
 *
 * EVERY TAIL PROOF AND EVERY CHECKPOINT IT WRITES NAMES THE RECORD (FORMAT.md section 6.10),
 * under their second schemes: the name its own tail already carries, else the one the other tails
 * carry, else the name of the record's genesis tail (`recordToWriteUnder`), resolved once per tail
 * at the first act that writes and never again. A write into a directory whose tails name two
 * records, or from a tail that names another record than the rest, is refused before anything
 * is born or sealed ({@link AnotherRecordError}).
 */

import {
  closeSync,
  existsSync,
  fstatSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  statSync,
  truncateSync,
} from 'node:fs';
import { basename, dirname } from 'node:path';

import type { CatalogEvent } from '../events/catalog.js';
import { EventParseError, unreadableReason } from '../events/parse.js';
import { isJsonText } from '../events/stored-json.js';
import type { UpcasterRegistry } from '../events/upcaster.js';
import {
  type Checkpoint,
  checkpointHash,
  parseCheckpoint,
  serializeCheckpoint,
  signCheckpoint,
} from './checkpoint.js';
import { type Cited, HeadsToCite } from './cited-heads.js';
import { CodedError } from './coded-error.js';
import { recordedNotSigned, signatureNotConfirmed, WriteNotLandedError } from './disk-words.js';
import { appendDurably, writeFileDurably } from './durable.js';
import {
  type ChainEntry,
  type Entry,
  entryHashHolds,
  parseEntry,
  sealEntry,
  serializeEntry,
} from './entry.js';
import type { WrittenEvent } from './hash.js';
import {
  type KeptHead,
  keepHead,
  keepWrittenHead,
  keepWrittenHeadDurably,
  keptHeadPath,
  readKeptHead,
  readWrittenHead,
  type WrittenHead,
} from './kept-head.js';
import type { KeyPair } from './keys.js';
import { materializePublicKey, signerOf, writeAnchor } from './keystore.js';
import {
  type ChainLayout,
  checkpointsPath,
  installationIdPath,
  segmentPath,
  tailDir,
  tailLockPath,
  tailProofPath,
} from './layout.js';
import { linesFromEnd, parseStoredLine } from './lines.js';
import {
  refuseToLockThroughALink,
  refuseToWriteThrough,
  refuseToWriteThroughALink,
} from './linked-write.js';
import {
  firstTailOfTheRepository,
  type HintOfTheId,
  inflightNames,
  markInflight,
  type PoolOptions,
  scanThePool,
  wroteOnThisBranch,
} from './pool.js';
import { recordToWriteUnder, type WriteUnder } from './record-name.js';
import { clearOrphanedStaging } from './staging.js';
import { lastTailCheckpoint, orderedSegments, readTailTip } from './store.js';
import { TailBusyError, withTailLock } from './tail-lock.js';
import { firstEntries, type NamesRelinked, namesRelinkedAt } from './tail-names.js';
import { serializeTailProof, signTailProof } from './tailproof.js';
import { unprovenWaiverReason } from './waiver.js';

/** Seal a segment once it grows past this many bytes (segments rotate by size). */
export const DEFAULT_MAX_SEGMENT_BYTES = 4 * 1024 * 1024;

/**
 * The most events one act of writing may leave unsigned before the writer signs on
 * its own. A CEILING, not the cadence, the sibling of {@link
 * DEFAULT_MAX_SEGMENT_BYTES}, and read the same way: 4 MiB is not how big a segment
 * is, it is how big one may get.
 *
 * THE NAME USED TO BE `DEFAULT_MAX_UNSIGNED_EVENTS`, and the premise that rename
 * falsifies is written down here because it cost a whole reading of this file. That
 * name says "sign every 64 events", so the product's actual cadence (one signature
 * per act of writing, whatever its size) read as a mechanism that never fires, and it
 * was written down as DEAD CODE, "inert", in two separate places. It is not dead: it
 * fires whenever
 * ONE act writes more than this many events, and the product has such an act;
 * `mnema decision import --write` puts two events on the tail per ADR through a
 * single writer and signs once at the end, so a directory of 33 ADRs crosses it. That
 * is measured, on the real command, in `every-write-signs-what-it-wrote.test.ts`.
 *
 * So the two numbers answer different questions and neither is the other's default:
 * the CADENCE is one signature per act (kept by the writing paths, and guarded by
 * that same file); this is the most an act may leave open before the writer stops
 * waiting for it.
 */
export const DEFAULT_MAX_UNSIGNED_EVENTS = 64;

export interface WriterOptions {
  readonly maxSegmentBytes?: number;
  /** The ceiling above; see {@link DEFAULT_MAX_UNSIGNED_EVENTS}. */
  readonly maxUnsignedEvents?: number;
  /**
   * Whether an append cites, in the envelope's `after`, the heads of the other tails of the
   * record that this tail has not cited yet ({@link HeadsToCite}). The product's writes do;
   * left out, the writer writes exactly the event it was handed.
   */
  readonly citeHeads?: boolean;
  /**
   * Told when this writer opens a new tail rather than append to its own, because that tail no
   * longer ends at the entry this installation last wrote to it: see {@link NewTail}. The
   * writer says nothing anywhere else; a surface that has a person or an agent to tell passes
   * this.
   */
  readonly onNewTail?: (opened: NewTail) => void;
  /**
   * Told, in a sentence, when a fact is on the tail and the disk failed what came after it (its
   * signature, or the sync of its line): the write succeeded and says so instead of failing
   * ({@link recordedNotSigned}). A write the disk refused before any of it landed is not told here:
   * it throws {@link WriteNotLandedError}. Unset, the sentence is lost.
   */
  readonly onUnsigned?: (sentence: string) => void;
  /**
   * The record this directory continues, asked only where none of its tails names one yet
   * (`recordToWriteUnder`, step 3): a project's private tree founded in the repository's git
   * directory while the tree from before it moved there still names a record, so the two join
   * as one record when a person moves the old one in. Absent, or `undefined`, the genesis rule
   * names it.
   */
  readonly continues?: () => string | undefined;
  /**
   * Where the locks and the notes of what this machine wrote last (`locks/<tail>.lock`, `.head`,
   * `.head.sig`, `.cited`) are kept, when they are not in the record's own `locks/`: the place
   * every worktree of a repository shares (FORMAT.md section 4). Present, the notes are read by
   * more than the checkout that wrote them, so the note of an append's intent is kept to the disk
   * and checked before the line ({@link keepWrittenHeadDurably}). Absent, the chain root holds them.
   */
  readonly sharedRoot?: string;
  /**
   * The tails this writer may go on with, in a repository whose worktrees share the notes
   * ({@link sharedRoot}), when the one its hint names does not go on here: see `pool.ts`. Absent,
   * the writer founds a tail at once, as it always did where nothing is shared.
   */
  readonly pool?: PoolOptions & { readonly hint?: HintOfTheId };
  /**
   * The record this writer's tail is to name, decided by its caller: the record a relink joins
   * (FORMAT.md section 6.11), which is written from a tail of the relinked tail's key that names
   * that record. Where the installation's own tail names another record, the writer opens a new
   * tail ({@link NewTail}), born naming this one; where the other tails name two records, which is
   * what a relink mends, the writer still writes under it. Absent, the record is decided as
   * `recordToWriteUnder` says.
   */
  readonly joins?: string;
}

/**
 * A new tail opened in place of one that no longer ends where this installation left it
 * (ADR-123: a tail is not forked).
 *
 * The installation's tail files are committed and its id is not: a branch switch, a merge that
 * took another side, a backup restored, or the id copied into another checkout leaves the id
 * naming a tail whose end is not the entry this installation wrote last ({@link KeptHead}).
 * Appending there is what forks a tail, so the writer takes a new installation id and writes a
 * new tail instead: the old one is left exactly as it is, and both verify.
 */
export interface NewTail {
  /** The tail this installation wrote to until now. */
  readonly from: string;
  /** The tail it writes to from this act on. */
  readonly to: string;
  /** The last entry this installation wrote to `from`, when it kept a note of one. */
  readonly kept: KeptHead | undefined;
  /** The entry `from` ends with on disk, or undefined when it holds none. */
  readonly found: KeptHead | undefined;
  /**
   * Why else the writer left `from`, where it still ended where this installation left it: its
   * owner relinked it into this record (`relinked`, FORMAT.md section 6.11: a relinked tail is
   * frozen at the head the relink names), or this write joins another record than the one it
   * names (`joins`, {@link WriterOptions.joins}); or it holds events above its last checkpoint
   * that the note this installation signed does not vouch for (`unvouched`, how many): this key
   * does not sign them (ADR-301).
   */
  readonly left?:
    | { readonly relinked: string }
    | { readonly names: string; readonly joins: string }
    | { readonly unvouched: number }
    | { readonly offBase: true; readonly unanswered?: true };
  /**
   * Why this write founded a tail where the record already holds others of this key, in a
   * repository whose worktrees share the notes: no tail of the key has a note of this machine
   * writing it (`no-note`), none ends here where this machine left it, or is on the base branch
   * (`none-ends-here`), the ones that do are the hint of another worktree (`reserved`), or were being
   * written by another process (`busy`). With `from` equal to `to` the write founded the tail its hint
   * named; otherwise it left `from` for the reason above and this adds why no other tail was taken.
   * `known` is how many tails of the key the record held.
   */
  readonly founded?: { readonly why: Founded; readonly known: number };
}

/** Why no other tail of the key went on: see {@link NewTail.founded}. */
export type Founded = 'no-note' | 'none-ends-here' | 'reserved' | 'busy' | 'base-unanswered';

const FOUNDED_AFTER_THE_MOVE: Record<Founded, string> = {
  'no-note':
    ', and this repository holds no note of this machine writing any other tail of this key',
  'none-ends-here':
    ', and no other tail of this key can go on from here (each ends elsewhere than where this machine left it, or is not on the base branch and was not written by this worktree on this branch)',
  reserved:
    ', and the tails of this key that end here where this machine left them are the ones other worktrees write',
  busy: ', and the tails of this key that could go on here were being written by another process',
  'base-unanswered':
    ', and the base branch did not answer in time about the tails of this key that could go on here',
};

const FOUNDED_HERE: Record<Founded, (known: number) => string> = {
  'no-note': (known) =>
    `this key already writes ${known} tail(s) in this record, and this repository holds no note of this machine writing any of them (a new clone, or this key on another machine), so appending to one could fork it`,
  'none-ends-here': (known) =>
    `none of the ${known} tail(s) this key already writes in this record can go on from here (each ends elsewhere than where this machine left it, or is not on the base branch and was not written by this worktree on this branch), so appending to one could fork it or make a merge conflict`,
  reserved: () =>
    'the tails of this key that end here where this machine left them are the ones other worktrees write, so this one writes its own',
  busy: () =>
    'the tails of this key that could go on here were being written by another process, so this one writes its own',
  'base-unanswered': () =>
    'the base branch did not answer in time about the tails of this key that could go on here, so this one writes its own',
};

/** The sentence a {@link NewTail} is told in: one wording for every surface that tells it. */
export function describeNewTail(opened: NewTail): string {
  const founded = opened.founded;
  if (founded !== undefined && opened.from === opened.to) {
    return `mnema: wrote to a new tail, ${opened.to}: ${FOUNDED_HERE[founded.why](founded.known)}.`;
  }
  const left = opened.left;
  if (left !== undefined) {
    const why =
      'offBase' in left
        ? left.unanswered === true
          ? 'the base branch did not answer in time about whether its end is on it, and it was not written by this worktree on this branch, so appending there could make a merge conflict where branches meet'
          : 'its end is not on the base branch and it was not written by this worktree on this branch, so appending there could make a merge conflict where branches meet'
        : 'unvouched' in left
          ? `${left.unvouched} event(s) above its last checkpoint are not ones this installation's signed note says it wrote, so this key does not sign them; they stay unsigned, and \`mnema verify --require=signed\` fails on them`
          : 'relinked' in left
            ? `its owner relinked it into record ${left.relinked.slice(0, 12)}..., which freezes it at the entry the relink names, and appending there would undo the relink`
            : `it names record ${left.names.slice(0, 12)}..., and this write joins record ${left.joins.slice(0, 12)}...: a tail names one record, so the write is made from a tail of this key born in the record it joins`;
    return `mnema: wrote to a new tail, ${opened.to}, and left tail ${opened.from} as it is: ${why}.`;
  }
  const beside = founded === undefined ? '' : FOUNDED_AFTER_THE_MOVE[founded.why];
  const held = (opened.found?.seq ?? -1) + 1;
  const why =
    opened.kept === undefined
      ? `this installation has no note of writing it here, and it holds ${held} entries (an ` +
        'installation id copied from another checkout, or a write from before this note was kept)'
      : opened.found === undefined
        ? `the last entry this installation wrote to it (seq ${opened.kept.seq}) is gone from it`
        : opened.found.seq < opened.kept.seq
          ? `it ends at seq ${opened.found.seq}, and the entries after it, up to the one this ` +
            `installation wrote last (seq ${opened.kept.seq}), are not in it`
          : `it ends at seq ${opened.found.seq}, not at the entry this installation wrote last ` +
            `(seq ${opened.kept.seq})`;
  return (
    `mnema: wrote to a new tail, ${opened.to}, and left tail ${opened.from} as it is: ${why}${beside}. ` +
    'A branch switch, a merge, a restored backup or a copied checkout does that, and appending ' +
    'there would fork the tail.'
  );
}

/**
 * What this writer last left the tail's files looking like: the witness it asks,
 * under the lock, before it trusts the state it is holding.
 *
 * It exists to keep ONE cost from coming back. The obvious way to be safe against
 * another process is to re-read the tail's end before every append, but this writer's
 * recovery reads every event above the last checkpoint, and the ceiling on that
 * window is a thousand in this workspace's own tests, so a per-append recovery is
 * quadratic in exactly the acts that write the most. Three `stat` calls answer the
 * only question that matters instead: did anything change since we looked? For a
 * process writing alone (which is nearly every process) the answer is always no,
 * and the recovery runs once, as it did before.
 *
 * The three are not a sample, they are the complete set of ways another writer can
 * change what this one is holding: it can grow the segment we are writing (bytes),
 * roll onto the next one (a segment we do not know about appearing), or sign a
 * checkpoint (the coverage moving under our buffer).
 *
 * THIS COMMENT ONCE ARGUED that `nextSegment` was redundant ("a roll is always
 * preceded by growth we would have seen") and the mutation battery falsified it:
 * blinding the mark to a new segment left ZERO tests red, which is a finding and not
 * a pass, and writing the case the argument said was unreachable turned it red. The
 * growth that pushes a segment over its cap happens BEFORE this writer's mark is
 * taken, not after; so the other writer opens, sees a full segment, rolls, and writes
 * every byte of its entry somewhere this writer is not looking. The segment we are
 * watching does not move at all. The case is
 * `tail-lock.test.ts > notices the other writer rolling onto a segment this one does
 * not know about`.
 */
interface TailMark {
  /** Size of the segment this writer believes it is appending to, or -1 if absent. */
  readonly segmentBytes: number;
  /** Whether the segment AFTER it exists: somebody else rolled. */
  readonly nextSegment: boolean;
  /** Size of `checkpoints.jsonl`, or -1 if absent. */
  readonly checkpointBytes: number;
  /** Size of the tail's first segment, or -1 if absent: losing the start is a move. */
  readonly firstBytes: number;
  /**
   * The clear note of this tail in the shared place, or null: where other worktrees write the same
   * tail, one that went on with it after this writer's last hold leaves the files of THIS checkout
   * as they were (it wrote them in its own, and this one merged them in later), and only the note says so.
   */
  readonly note: string | null;
}

/** What a hold decided: the act's result, or the tail to go to instead. */
type Held<T> = { readonly result: T } | Elsewhere;
type Elsewhere =
  | { readonly movedOn: NewTail; readonly next: string }
  | { readonly pooled: string }
  | { readonly hinted: string }
  | { readonly back: true };

/** What one write learnt while it looked for a tail to go on with: see {@link ChainWriter.decideTheTail}. */
interface PoolRound {
  /** The tails of the pool this write found unfit, or busy. */
  readonly tried: Set<string>;
  /** The tails the pool offered and this write has not tried yet; undefined until it looked. */
  queue?: string[];
  /** What the look found, for the sentence of a founding. */
  known?: number;
  noted?: number;
  reserved: boolean;
  unanswered?: boolean;
  busy: boolean;
}

/** A mark no real tail can produce, so the first act on a tail always recovers. */
const NO_MARK: TailMark = {
  segmentBytes: -2,
  nextSegment: false,
  checkpointBytes: -2,
  firstBytes: -2,
  note: '-',
};

export class ChainWriter {
  private head: string | null = null;
  /** The entry hash {@link head} was chained onto, or null at seq 0: kept in the signed note. */
  private headPrev: string | null = null;
  private nextSeq = 0;
  private segment = 1;
  private segmentBytes = 0;
  /** Seq of the last event covered by a checkpoint, or -1 if none. */
  private lastCheckpointedSeq = -1;
  /** Hash of the last checkpoint, or null if none: the link the next one signs. */
  private lastCheckpointHash: string | null = null;
  /**
   * The events appended since the last checkpoint, in seq order: exactly what
   * the next checkpoint signs. Held in memory so signing never round-trips
   * through the store: the writer already knows what it appended, and a fresh
   * process refills this from the END of the tail in `recover()`. Without it,
   * signing a range of one or two events re-read and re-parsed the whole tail,
   * making a run of N writes cost O(N²).
   *
   * It holds the WRITTEN form, and that matters most for the entries `recover()`
   * puts here: those came off the disk and were lifted on the way. A checkpoint
   * folded over the lifted reading would be a signature over bytes that are not
   * on the tail: signed by the real key, so no verifier could tell it from a
   * forgery, and every one of them would report the range as broken. The buffer
   * a running process fills is the same form, so the two paths cannot drift.
   */
  private pending: WrittenEvent[] = [];

  /**
   * Set by `recover()` when the tail's end falls short of what its last checkpoint signed, and
   * thrown by both append doors before anything is sealed ({@link TailDamagedError}). Cleared by
   * the next recovery that finds the tail whole again.
   */
  private damage: TailDamagedError | undefined;

  /**
   * The tail as this writer last left it. Compared under the lock before every act;
   * a difference means another process wrote and the held state is stale. See
   * {@link TailMark}.
   *
   * It starts as a value no real tail can produce, so the first act always recovers
   * rather than trusting a default that happens to match an empty tail.
   */
  private mark: TailMark = NO_MARK;

  /**
   * Whether this writer has already made sure its tail is born: see {@link ensureBorn}.
   * Per writer, so the three checks run once per writer rather than once per append.
   */
  private born = false;

  /**
   * Whether this writer is inside {@link underTailLock} right now. It is what lets an act run
   * through {@link exclusively} append through the public doors without taking a lock it
   * already holds: see {@link underTailLock}.
   */
  private holding = false;

  private readonly maxSegmentBytes: number;
  private readonly maxUnsignedEvents: number;
  /** What an append cites, when this writer cites at all. */
  private heads: HeadsToCite | undefined;

  private tailId: string;
  /** Where this writer's locks and notes are: {@link WriterOptions.sharedRoot}, or the chain's own root. */
  private readonly shared: ChainLayout;
  /** Whether the notes are shared by other checkouts, which is what makes the intent note durable. */
  private readonly sharedNotes: boolean;
  /** {@link WriterOptions.pool}, once there is a hint to move: absent where nothing is shared. */
  private readonly pool: (PoolOptions & { readonly hint?: HintOfTheId }) | undefined;
  /** The installation id of the hint this writer started from or moved it to: not always the tail it writes. */
  private hintId: string;
  /** Whether the tail this writer is at was offered by the pool and is not yet the hint: see {@link decideTheTail}. */
  private fromPool = false;
  private readonly citeHeads: boolean;
  private readonly onNewTail: ((opened: NewTail) => void) | undefined;
  private readonly onUnsigned: ((sentence: string) => void) | undefined;
  /**
   * Set when a line landed and the disk failed its sync: that fact is told as not yet signed, so
   * nothing signs it until the next append of this writer, whose checkpoint covers it.
   */
  private holdSigning = false;
  /** {@link WriterOptions.continues}. */
  private readonly continues: (() => string | undefined) | undefined;
  /** {@link WriterOptions.joins}. */
  private readonly joins: string | undefined;
  /**
   * What each tail names, the relinks applied, as the recovery of this act read it: asked once
   * per act and handed to {@link recordName}, which would otherwise read it again.
   */
  private namesRead: NamesRelinked | undefined;
  /**
   * Set by {@link recover} when the tail does not end at the entry this installation last
   * wrote to it: the act does not run there, and {@link underTailLock} moves to a new tail.
   */
  private movedOn: NewTail | undefined;
  /** A new tail this writer moved to and has not told of yet: see {@link sayNewTailOnceWritten}. */
  private unsaid: NewTail | undefined;
  /** The head last kept in the note ({@link keepHead}), so an act that wrote nothing writes no note. */
  private keptHash: string | null = null;
  /** The signed note last kept or read ({@link keepWrittenHead}), as {@link noteSaying} says it. */
  private keptNote: string | null = null;
  /**
   * The record this tail's proof and checkpoints name, once {@link recordName} resolved it: per
   * tail, so a writer that moves to a new tail resolves it again (from the tail it left, which the
   * other tails now include).
   */
  private record: string | undefined;

  constructor(
    private readonly layout: ChainLayout,
    private readonly keyPair: KeyPair,
    installationId: string,
    private readonly upcasters: UpcasterRegistry,
    options: WriterOptions = {},
    /**
     * What must be on disk before this tail's first byte that opening did not write: a machine's
     * first key, made in memory and kept here (`keyToSignWith`). Run once, at birth.
     */
    private readonly keepBeforeBirth?: () => void,
    /**
     * The installation id to write under once the current one names a tail that no longer
     * ends where this installation left it ({@link NewTail}): another process's, when it moved
     * on first, or a new one. Absent for an installation whose id is not kept yet, whose tail
     * nobody else can have written.
     */
    private readonly nextInstallationId?: (current: string) => string,
  ) {
    this.maxSegmentBytes = options.maxSegmentBytes ?? DEFAULT_MAX_SEGMENT_BYTES;
    this.maxUnsignedEvents = options.maxUnsignedEvents ?? DEFAULT_MAX_UNSIGNED_EVENTS;
    this.tailId = `${keyPair.fingerprint}-${installationId}`;
    this.hintId = installationId;
    this.pool = options.pool;
    this.sharedNotes = options.sharedRoot !== undefined;
    this.shared = options.sharedRoot === undefined ? layout : { root: options.sharedRoot };
    this.citeHeads = options.citeHeads === true;
    this.onNewTail = options.onNewTail;
    this.onUnsigned = options.onUnsigned;
    this.continues = options.continues;
    this.joins = options.joins;
    this.heads = this.citeHeads
      ? new HeadsToCite(layout, this.tailId, upcasters, this.shared)
      : undefined;
    // NOTHING IS WRITTEN HERE. Both the recovery and the birth happen in the first act,
    // under the tail's lock.
    //
    // Recovery cannot happen here, because it TRUNCATES a torn trailing fragment, and
    // cutting a file another process is appending to is the hazard the tail lock
    // closed. So it runs under the lock, in the first act: the starting {@link mark}
    // is a value no real tail can produce, so that act always recovers.
    //
    // THIS COMMENT SAID BIRTH COULD NOT MOVE WITH IT: "taking the lock in a constructor
    // makes `openChainForWriting` block on another process's append, … so the directory
    // and the ownership proof are written here, unlocked." The reason holds against the
    // constructor and never held against the first APPEND, which already runs under the
    // lock. What moved birth there is a measurement. The surfaces open a writer before an
    // operation's own door speaks (an oversize field, a name holding a credential, a
    // move the gate refuses), so a key new to the tree that was refused left the tail's
    // directory and its proof behind (with the key's public half, see
    // `openChainForWriting`), untracked, published by the next `git add -A`, and that
    // tail with no event in it changed every `verify` of the record after it. Born in
    // {@link ensureBorn}, a writer that appends nothing leaves nothing a clone receives.
    //
    // AND THE ONE UNGUARDED RACE THIS COMMENT EXCUSED IS GONE. Two fresh processes could
    // both find the proof absent and both write it: benign only because the bytes are an
    // Ed25519 signature over the tail id, which is deterministic. Two processes of one
    // installation share the tail, hence the lock, so under it the second finds the proof
    // the first wrote.
  }

  /**
   * Gives this tail what a clone needs in order to verify it (the key's public half in the
   * chain, the tail's directory, and its proof of ownership) once, from inside the first act
   * that appends: after that act's own refusals ({@link refuseUnreadable},
   * {@link refuseUnprovenWaiver}) and before its first byte.
   *
   * It is the ONE PLACE a tail is born, and the two append doors are the only callers, which
   * is what makes "a writer that appends nothing publishes nothing" a property of this class
   * rather than of every operation that opens one: `writer.test.ts`, *a tail is born at its
   * first append, not when its writer opens*, asks it of both doors, of the writer's own
   * refusals and of a checkpoint with nothing to sign. Why here and not at open is the
   * constructor's comment.
   *
   * Idempotent, like each of the three: a tail another process already gave birth to (or one
   * this installation has been writing for years) is left exactly as it is.
   */
  private ensureBorn(): void {
    if (this.born) return;
    // First, so a key another process kept meanwhile refuses before anything lands in the chain.
    this.keepBeforeBirth?.();
    materializePublicKey(this.layout, this.keyPair);
    mkdirSync(tailDir(this.layout, this.tailId), { recursive: true });
    clearOrphanedStaging(this.shared, this.tailId);
    this.ensureTailProof();
    this.born = true;
  }

  /**
   * THE ONE DOOR every act that touches this tail's files goes through: it takes the
   * tail's lock, brings the held state back in line with the disk if another process
   * moved it, runs the act, and records where it left the files.
   *
   * There is one of these rather than three because the rule, "read the end and
   * append to it as one indivisible act", is one rule, and a rule with three
   * readings is the shape that produces the divergence nobody notices. The public
   * doors ({@link append}, {@link appendAll}, {@link checkpoint}, {@link exclusively})
   * are thin wrappers that do nothing but call this; the bodies of the first three
   * live in `*Locked` siblings, which may be called ONLY from inside it.
   * {@link capUnsignedWindow} signs through {@link signLocked}, never through the
   * public {@link checkpoint}, for the reason it always did: it is already inside.
   *
   * THIS SAID THE SPLIT "is also what keeps the lock non-reentrant", and the lock file
   * still is: a second writer of this tail, in this process or another, waits. What
   * changed is that THIS WRITER may now ask again while it holds it: an act run through
   * {@link exclusively} decides on the record and then appends through the public
   * doors, so the second ask runs the act at once, under the hold it is already in,
   * instead of waiting two seconds on its own lock and refusing
   * (`tail-lock.test.ts`, *an exclusive act appends through the public doors*).
   *
   * The mark is written AFTER the act and only if it returned. An act that threw may
   * have left the files in a state this writer's fields do not describe, so leaving
   * the mark stale is the conservative answer: the next act sees "moved" and recovers.
   */
  private underTailLock<T>(act: () => T): T {
    // Already held by this writer: the outer hold resynced on the way in and writes the
    // mark on the way out, so the inner act only runs.
    if (this.holding) return act();
    try {
      return this.underTailLockOnce(act);
    } finally {
      this.sayNewTailOnceWritten();
    }
  }

  /** {@link underTailLock} without the telling: the lock, the resync and the act. */
  private underTailLockOnce<T>(act: () => T): T {
    // No options: the writer takes the lock's own budgets. They are not a knob this
    // class forwards, because nothing in the product would have a reason to differ
    // from them, and an option no caller sets is the defect this workspace already
    // has a name for.
    //
    // A TAIL THAT NO LONGER ENDS WHERE THIS INSTALLATION LEFT IT is not written to: the resync
    // finds it ({@link recover}), the act does not run, and the tail to go on with is decided while
    // this tail's lock is still held ({@link decideTheTail}): the hint another process of this
    // worktree moved, else a tail of this key that ends here where this machine left it (the pool),
    // else a new installation id, which is chosen here so a second process of this installation that
    // meets the same end after it adopts the id it chose instead of choosing another. The act then
    // runs under that tail's lock. A tail the pool offered is taken without waiting: one being
    // written is left to its writer, and the decision is made again without it.
    const round: PoolRound = { tried: new Set(), reserved: false, busy: false };
    for (;;) {
      // Before the lock, which is itself a write: taking it makes `locks/` and the lock file. A window
      // stays between this question and the lock's creation: where `locks/` becomes a link in it, the
      // lock file is created at the link's target, and the question under the lock refuses right after.
      refuseToLockThroughALink(this.shared, this.tailId);
      let held: Held<T>;
      try {
        held = withTailLock(
          tailLockPath(this.shared, this.tailId),
          () => this.heldAct(act, round),
          this.fromPool ? { waitMs: 0 } : {},
        );
      } catch (error) {
        if (!(this.fromPool && error instanceof TailBusyError)) throw error;
        round.tried.add(this.tailId);
        round.busy = true;
        this.pointAt(this.hintId);
        continue;
      }
      if ('result' in held) return held.result;
      if ('pooled' in held) {
        this.pointAt(held.pooled);
        this.fromPool = true;
      } else if ('hinted' in held) {
        // The hint another process of this worktree moved while this tail had nothing in it.
        this.hintId = held.hinted.slice(this.keyPair.fingerprint.length + 1);
        this.pointAt(held.hinted);
      } else if ('back' in held) {
        // A tail the pool offered turned out not to go on here: the decision is made again from the hint.
        this.pointAt(`${this.keyPair.fingerprint}-${this.hintId}`);
      } else {
        this.moveTo(held.movedOn, held.next, this.whyFounded(round, (round.known ?? 1) - 1));
      }
    }
  }

  /** What the lock of the tail runs: the resync, the decision of which tail, and the act. */
  private heldAct<T>(act: () => T, round: PoolRound): Held<T> {
    this.holding = true;
    // Nothing is kept on the way out of a refusal to write through a link: the notes are paths it names.
    let mayWrite = false;
    let returned = false;
    try {
      // Under the lock and before the resync, which can cut the segment, and before anything is sealed.
      refuseToWriteThroughALink(this.layout, this.shared, this.tailId, this.keyPair.fingerprint);
      if (this.pool !== undefined) {
        refuseToWriteThrough({ root: this.pool.checkoutRoot }, [
          'inflight',
          `inflight/${this.tailId}`,
          `inflight/${this.tailId}.${process.pid}`,
        ]);
      }
      mayWrite = true;
      this.resyncIfMoved();
      const decided = this.decideTheTail(round);
      if (decided !== undefined) return decided;
      if (this.fromPool) this.takeTheHint();
      const result = act();
      returned = true;
      return { result };
    } finally {
      if (mayWrite) this.keepHeadIfWritten();
      // After the notes, which the mark reads: a mark taken before them would be stale on the next act.
      if (returned) this.mark = this.readMark();
      this.holding = false;
    }
  }

  /**
   * Where this act goes, decided under the lock of the tail it found: nowhere else when the tail goes
   * on here (undefined), or the tail to move to. A tail that does not end where this machine left it is
   * left, and so is a hint that names a tail with nothing in it where the pool holds one to go on with
   * (a worktree that has written nothing yet): the hint another process moved, the pool, a new id.
   */
  private decideTheTail(round: PoolRound): Elsewhere | undefined {
    const movedOn = this.movedOn;
    if (this.fromPool && (movedOn !== undefined || this.damage !== undefined)) {
      round.tried.add(this.tailId);
      return { back: true };
    }
    const pool = this.pool;
    const hint = pool?.hint;
    const unwritten = !this.fromPool && this.head === null && this.damage === undefined;
    if (movedOn === undefined && !(hint !== undefined && unwritten)) return undefined;
    if (pool !== undefined && hint !== undefined) {
      const there = hint.read();
      if (there !== this.hintId) {
        // Another process of this worktree moved the hint first: this write goes where it did.
        return movedOn === undefined
          ? { hinted: `${this.keyPair.fingerprint}-${there}` }
          : { movedOn, next: there };
      }
      const picked = this.fromThePool(pool, round);
      if (picked !== undefined) return { pooled: picked };
    }
    if (movedOn === undefined) {
      this.sayFoundedHere(round);
      return undefined;
    }
    return { movedOn, next: this.chooseNextInstallation() };
  }

  /** The first tail of the pool this write may go on with, or undefined where none can. */
  private fromThePool(pool: PoolOptions, round: PoolRound): string | undefined {
    const except = new Set([...round.tried, this.tailId]);
    if (round.queue === undefined) {
      const scan = scanThePool({
        layout: this.layout,
        shared: this.shared,
        checkout: { root: pool.checkoutRoot },
        fingerprint: this.keyPair.fingerprint,
        except,
        pool,
        upcasters: this.upcasters,
      });
      round.queue = [...scan.queue];
      round.known = scan.known;
      round.noted = scan.noted;
      round.reserved = scan.reserved;
      round.unanswered = scan.unanswered;
    }
    for (;;) {
      const next = round.queue.shift();
      if (next === undefined) return undefined;
      if (!except.has(next)) return next;
    }
  }

  /** The reason a write found no tail to go on with, for the sentence of a new tail: none where the key has no other tail. */
  private whyFounded(round: PoolRound, known: number): NewTail['founded'] {
    if (this.pool === undefined || round.known === undefined || known < 1) return undefined;
    const why: Founded = round.busy
      ? 'busy'
      : round.unanswered === true
        ? 'base-unanswered'
        : round.reserved
          ? 'reserved'
          : round.noted === 0
            ? 'no-note'
            : 'none-ends-here';
    return { why, known };
  }

  /** Founding the tail the hint named, where the key already writes others: said once the tail is born. */
  private sayFoundedHere(round: PoolRound): void {
    // A move to a new tail already said why it left the old one.
    if (this.unsaid !== undefined) return;
    const founded = this.whyFounded(round, round.known ?? 0);
    if (founded === undefined) return;
    this.unsaid = {
      from: this.tailId,
      to: this.tailId,
      kept: undefined,
      found: undefined,
      founded,
    };
  }

  /** The installation id the next tail is written under: see {@link nextInstallationId}. */
  private chooseNextInstallation(): string {
    if (this.nextInstallationId === undefined) {
      throw new Error(
        `chain: tail ${this.tailId} does not end where this installation left it, and this ` +
          'writer was given no way to choose another installation id',
      );
    }
    return this.nextInstallationId(this.hintId);
  }

  /** Points this writer at the tail `tailId`, which it has not read. */
  private pointAt(tailId: string): void {
    this.tailId = tailId;
    this.fromPool = false;
    this.heads = this.citeHeads
      ? new HeadsToCite(this.layout, this.tailId, this.upcasters, this.shared)
      : undefined;
    this.resetForTail();
  }

  /** Points this writer at the tail of `installationId`, which becomes its hint, and tells whoever asked to be told. */
  private moveTo(movedOn: NewTail, installationId: string, founded: NewTail['founded']): void {
    this.hintId = installationId;
    this.pointAt(`${this.keyPair.fingerprint}-${installationId}`);
    this.unsaid = { ...movedOn, to: this.tailId, ...(founded === undefined ? {} : { founded }) };
  }

  /** A tail the pool offered went on here: it is this worktree's hint from now on, and nothing is said of it. */
  private takeTheHint(): void {
    this.hintId = this.tailId.slice(this.keyPair.fingerprint.length + 1);
    this.pool?.hint?.adopt(this.hintId);
    this.fromPool = false;
  }

  /**
   * Tells {@link WriterOptions.onNewTail} of a new tail only once the tail is born. An act
   * refused before it appended anything leaves no tail behind it, and "wrote to a new tail" must
   * not precede a refusal that wrote nothing; the next act of this writer that does write says it.
   */
  private sayNewTailOnceWritten(): void {
    if (this.unsaid === undefined || !this.born) return;
    const opened = this.unsaid;
    this.unsaid = undefined;
    this.onNewTail?.(opened);
  }

  /** Everything this writer believed about the tail it left, back to a tail it has not read. */
  private resetForTail(): void {
    this.head = null;
    this.headPrev = null;
    this.nextSeq = 0;
    this.segment = 1;
    this.segmentBytes = 0;
    this.lastCheckpointedSeq = -1;
    this.lastCheckpointHash = null;
    this.pending = [];
    this.damage = undefined;
    this.movedOn = undefined;
    this.keptHash = null;
    this.keptNote = null;
    this.record = undefined;
    this.namesRead = undefined;
    this.born = false;
    this.mark = NO_MARK;
  }

  /**
   * Keeps the signed note BEFORE an append's line ({@link keepWrittenHead}): the end the append
   * chains onto, and in `next` the last entry it is about to write, so a kill anywhere after this
   * leaves the tail ending at an entry the note names and the next recovery signs it ({@link
   * recover}). A note that could not be kept costs what it always cost: an entry that lands with
   * no note vouching for it goes to a new tail, unsigned.
   */
  private keepIntent(last: Entry): void {
    const note: WrittenHead = {
      seq: this.nextSeq - 1,
      hash: this.head,
      prev: this.headPrev,
      coveredThrough: this.lastCheckpointedSeq,
      checkpoint: this.lastCheckpointHash,
      next: { seq: last.link.seq, hash: last.link.hash },
    };
    // The mark that this worktree began the act, before the note that names it: where other worktrees
    // read the note, only the one whose mark names the entry may finish an act that died ({@link recover}).
    if (this.pool !== undefined && note.next !== null) {
      markInflight({ root: this.pool.checkoutRoot }, this.tailId, note.next, this.pool.branch());
    }
    // Where other checkouts read the note, it is certain before the line it names or the act is refused.
    (this.sharedNotes ? keepWrittenHeadDurably : keepWrittenHead)(
      this.shared,
      this.tailId,
      note,
      this.keyPair,
    );
    this.keptNote = noteSaying(note);
  }

  /**
   * Keeps the last entry this writer wrote ({@link keepHead}), on the way out of every hold and
   * only when it moved: a note per act that appended, none for one that did not. The signed note
   * ({@link keepWrittenHead}) is kept first, and also when only the coverage moved, with `next`
   * null: the act ended. A crash before either leaves the note {@link keepIntent} kept before the
   * line, which names the end the tail then has, so the next recovery signs it in this tail.
   */
  private keepHeadIfWritten(): void {
    if (this.movedOn !== undefined || this.damage !== undefined || this.head === null) return;
    const note: WrittenHead = {
      seq: this.nextSeq - 1,
      hash: this.head,
      prev: this.headPrev,
      coveredThrough: this.lastCheckpointedSeq,
      checkpoint: this.lastCheckpointHash,
      next: null,
    };
    const saying = noteSaying(note);
    if (saying !== this.keptNote) {
      keepWrittenHead(this.shared, this.tailId, note, this.keyPair);
      this.keptNote = saying;
    }
    if (this.head === this.keptHash) return;
    keepHead(this.shared, this.tailId, { seq: note.seq, hash: this.head });
    this.keptHash = this.head;
  }

  /**
   * Runs `act` with this tail's lock held, and lets it append through this writer's own
   * doors while it holds it.
   *
   * It is for an operation whose append DEPENDS ON WHAT IT READ: a move judged against the
   * state a decision is in, a label numbered from how many decisions there are, a founding
   * decided from whether the record already holds one. Read outside the lock and appended
   * inside it, two sessions of one installation both read the same state and both append:
   * measured on the built binary, `decision move accept` and `… reject` run together both
   * exited 0 in 19 of 20 rounds, and two concurrent `decision record` minted the same
   * `ADR-<n>` in 10 of 10. Read inside it, the second reads what the first appended.
   *
   * The act's own reading of the record is the caller's business; this offers only the
   * hold. It is not a transaction: an act that appends twice and then throws leaves both
   * appends on the tail, as two calls of {@link append} would.
   *
   * @throws {TailBusyError} if another process holds the tail past the wait budget.
   * Nothing of `act` has run.
   */
  exclusively<T>(act: () => T): T {
    return this.underTailLock(act);
  }

  /**
   * Refuses with {@link TailDamagedError} when the tail's end falls short of what its last
   * checkpoint signed, or when its first segment does not begin at seq 0 (a start that is
   * missing: `tail prune` removes a tail whole and never a segment, so a tail that begins
   * higher lost its first file), and does nothing otherwise. It takes the hold and brings the writer up to
   * what the disk holds first, so what it says is the files' state now. It is for a caller that
   * has another refusal in hand and owes the person the real problem before it: the tail's
   * damage comes first, because a refusal about the anchor sends someone to a file that is not
   * the damage.
   *
   * @throws {TailDamagedError} the damage, exactly as an append would throw it.
   * @throws {TailBusyError} if another process holds the tail past the wait budget.
   */
  refuseIfDamaged(): void {
    this.underTailLock(() => {
      this.refuseDamagedTail();
    });
  }

  /**
   * Re-reads the tail's end if, and only if, its files are not where this writer left
   * them. The cheap question that keeps the expensive one rare: see {@link TailMark}.
   */
  private resyncIfMoved(): void {
    if (this.unmovedSinceLastHold()) return;
    this.recover();
  }

  private readMark(): TailMark {
    return {
      segmentBytes: sizeOf(segmentPath(this.layout, this.tailId, this.segment)),
      nextSegment: sizeOf(segmentPath(this.layout, this.tailId, this.segment + 1)) >= 0,
      checkpointBytes: sizeOf(checkpointsPath(this.layout, this.tailId)),
      firstBytes: sizeOf(segmentPath(this.layout, this.tailId, 1)),
      note: this.pool === undefined ? null : noteOf(this.shared, this.tailId),
    };
  }

  /**
   * Writes this tail's proof of ownership once, at birth: the key signs a
   * statement naming its own tail id, so the verifier can tie the locally-chosen
   * installation-id suffix to the key that owns it. Idempotent (a reopened tail
   * already has one) and never overwrites a proof that reads, whoever's it is (ADR-354). A proof
   * that is empty or does not parse is what a power cut at birth leaves: no reader can use it and
   * nothing else would ever replace it, so it is written again, to the disk, like the birth.
   */
  private ensureTailProof(): void {
    const path = tailProofPath(this.layout, this.tailId);
    if (existsSync(path) && !unreadableProof(path)) return;
    const proof = signTailProof(this.tailId, this.keyPair, this.recordName());
    writeFileDurably(path, `${serializeTailProof(proof)}\n`);
  }

  /**
   * The record this tail's proof and checkpoints name (FORMAT.md section 6.10), resolved at the
   * first act that writes, under the lock, and kept for the tail: see {@link recordToWriteUnder}
   * for the order, and `tail-names.ts` for what each tail is read to name.
   *
   * Both append doors ask it after their own refusals and before the tail is born, so a refusal
   * here leaves nothing on disk; a checkpoint asks it before it signs.
   *
   * @throws {AnotherRecordError} where the directory's other tails name two records, or this
   * tail names one and the other named tails another. Nothing is written.
   */
  private recordName(): string {
    if (this.record !== undefined) return this.record;
    const names = this.namesRead ?? namesRelinkedAt(this.layout);
    const under = recordToWriteUnder(
      this.tailId,
      names.named,
      () => firstEntries(this.layout, this.upcasters),
      this.continues,
      this.joins,
    );
    if (!('name' in under)) throw new AnotherRecordError(this.tailId, under);
    this.record = under.name;
    return under.name;
  }

  /**
   * The tail this writer owns: `<fingerprint>-<installationId>`.
   *
   * Exposed for the one rule that is about a tail's IDENTITY rather than its
   * contents: a waiver may not name the tail it is written to, and an operation
   * that wants to refuse that in words (rather than meet the writer's throw) has to
   * be able to ask which tail it is about to write to.
   */
  get tail(): string {
    return this.tailId;
  }

  /**
   * The full fingerprint of the key this writer signs with: the `signerFp`
   * every event it writes must carry, and the same key its checkpoints bind.
   * Exposed so the operation that builds an event stamps the identity from the
   * very key that will sign it, never a value passed in from elsewhere.
   */
  get signerFingerprint(): string {
    return this.keyPair.fingerprint;
  }

  /**
   * The anchor id this writer authorizes as, WHO its events speak for. Read
   * from LOCAL material (`keys/<fp>.anchor`): the anchor this installation
   * founded (its own) or one it enrolled into (another key's). When no anchor is
   * recorded yet, it derives its own (the anchor it will found on first use)
   * so a caller always reads a real anchor. A caller cannot supply it, so
   * identity comes from the local key or its recorded membership, never a typed
   * string.
   */
  get anchor(): string {
    return signerOf(this.layout, this.keyPair.fingerprint).anchor;
  }

  /**
   * Recovers writer state from disk: the highest segment file gives the current
   * segment and its size; the last checkpoint gives the last checkpointed seq
   * and hash; the END of the tail gives the head hash, the next seq, and the
   * events still to be signed.
   *
   * The order is load-bearing:
   *   1. CHECKPOINTS FIRST. How far back the tail must be read is decided by the
   *      coverage, and so is whether a torn end may be cut at all.
   *   2. THE TIP, AND THE FRAGMENT IN IT. A crash mid-append can leave a partial
   *      line with no newline at the end of the last segment. The tip is read with
   *      that fragment still on disk, and a fragment that happens to PARSE is
   *      left out of it, so it cannot become the head: a head the cut below
   *      deletes, leaving the next append chained to a hash no reader can find.
   *      One read of the END of the tail then answers the remaining questions:
   *      the last complete entry is the head, and the entries above the coverage
   *      are the events the next checkpoint owes a signature. The same read says whether
   *      the tail BEGINS at seq 0 ({@link damageInTheFiles}): one that does not is refused
   *      like a cut end, whatever the anchor says.
   *   3. THE CUT, ONLY ABOVE THE COVERAGE. THIS USED TO HEAL FIRST, before the
   *      checkpoint was read, and so cut whatever the end held: a signed line
   *      truncated by an edit, or one that had only lost its newline, went with
   *      the fragment, and the next append reused a seq the checkpoint had already
   *      signed and then failed to sign, reporting a failure about a fact that
   *      had landed. A last complete line below the checkpoint's `toSeq` is not
   *      something a crash leaves ({@link TailDamagedError}), so then nothing is
   *      cut, and both append doors refuse. Above the coverage the fragment is the
   *      crash's, and it is cut as it always was. (Readers that do not heal [the
   *      verifier, the replay] still tolerate the fragment on read.)
   *
   * Every one of those reads enters its file from the END and stops at what it
   * came for, so none of them grows with the tail. That matters because the
   * product opens a writer per write: a read here that scaled with the history
   * would make a run of N writes cost O(N²), which is the shape this recovery
   * was rebuilt to remove.
   */
  private recover(): void {
    // The coverage is the disk's, a checkpoint that lost only its newline included: a process
    // that held another one goes by what the file holds now, not by what it last read.
    const lastCp = lastTailCheckpoint(this.layout, this.tailId);
    this.lastCheckpointedSeq = lastCp?.toSeq ?? -1;
    this.lastCheckpointHash = lastCp === undefined ? null : checkpointHash(lastCp);
    const end = readEndOfTheTail(this.layout, this.tailId, this.upcasters, lastCp);
    const { lastSegment, fragment, walked, tip, lastComplete } = end;
    if (lastSegment !== undefined) {
      const match = /(\d+)\.jsonl$/.exec(lastSegment);
      this.segment = match ? Number.parseInt(match[1] as string, 10) : 1;
      this.segmentBytes = fragment?.start ?? Math.max(sizeOf(lastSegment), 0);
    }
    const damaged = damageInTheFiles(this.layout, this.tailId, this.upcasters, lastCp, end);
    if (damaged !== undefined) {
      // Nothing is cut, nothing is owed a signature, and both append doors refuse.
      this.damage = damaged;
      this.nextSeq = damaged.signedThrough + 1;
      this.pending = [];
      return;
    }
    this.damage = undefined;
    // THE END IS THE ENTRY THIS INSTALLATION WROTE LAST, OR THIS TAIL IS NOT WRITTEN TO. This
    // recovery used to refuse only an end below the coverage (above), and appended to any other
    // end: one checkout switched to another branch, or an id copied into another checkout, went
    // on writing one tail on two lines of history with exit 0, and the merge that joined them
    // was refused by both readers. What it holds now is the note of the last entry this
    // installation wrote here ({@link readKeptHead}): an end that is not that entry (shorter,
    // longer, or another entry at that seq), or a tail that holds entries and no note at all,
    // is left exactly as it is, fragment included, and the act goes to a new tail
    // ({@link NewTail}). A tail that holds nothing has nothing to fork.
    const last = tip.at(-1);
    const kept = readKeptHead(this.shared, this.tailId);
    const found = last === undefined ? undefined : { seq: last.link.seq, hash: last.link.hash };
    // THE SIGNED NOTE SAYS IT FIRST (ADR-314). It is kept before every append as well as after the
    // hold ({@link keepIntent}), so an end it names, or the entry its pending append was about to
    // write, is this installation's whatever the clear note says: a kill between the line and the
    // clear note left the clear note behind, and that end used to go to a new tail, unsigned.
    const note = readWrittenHead(this.shared, this.tailId, this.keyPair.publicKey);
    const endSeq = found?.seq ?? -1;
    const isEnd = (end: { seq: number; hash: string | null }): boolean =>
      end.seq === endSeq && end.hash === (found?.hash ?? null);
    const ownBySignedNote =
      note !== undefined &&
      (isEnd(note) ||
        (note.next !== null && isEnd(note.next)) ||
        // This installation's own last entry, torn by a power cut after its note was signed: the
        // note names the entry chained onto this end, and only that entry's line is gone.
        (fragment !== undefined &&
          note.seq === endSeq + 1 &&
          note.prev === (found?.hash ?? null) &&
          (!fragment.parses || walked.at(-1)?.link.hash === note.hash)));
    // The one end that is not the noted entry and is still this installation's: the noted entry
    // itself, torn by a crash into the fragment the cut below removes (whole but for its
    // newline, it parses and is that entry; cut shorter, it sits at the seq after the end).
    const tornOwnWrite =
      fragment !== undefined &&
      kept !== undefined &&
      kept.seq === (found?.seq ?? -1) + 1 &&
      (!fragment.parses || walked.at(-1)?.link.hash === kept.hash);
    // AN ACT THAT DIED IN ANOTHER WORKTREE is not this one's to finish. Its note names the end it began
    // from and the entry it was about to write, and the clear note still names the end it began from:
    // a worktree whose tail ends there too would go on with it, while the one that died may hold the
    // entry the note names, and the two would write one tail from the same end. Only the worktree whose
    // mark names that entry goes on from the end (the end the entry makes is anyone's who holds it).
    const foreignAct =
      this.pool !== undefined &&
      note?.next != null &&
      !isEnd(note.next) &&
      !inflightNames({ root: this.pool.checkoutRoot }, this.tailId, note.next);
    const endsWhereLeft =
      !foreignAct &&
      (ownBySignedNote ||
        tornOwnWrite ||
        (kept === undefined
          ? found === undefined
          : found !== undefined && found.seq === kept.seq && found.hash === kept.hash));
    if (!endsWhereLeft) {
      this.movedOn = { from: this.tailId, to: this.tailId, kept, found };
      return;
    }
    // A TAIL THIS WORKTREE DID NOT WRITE ON THE BRANCH IT IS ON goes on only where its end is on the base
    // branch (ADR-446): a branch cut from the one that wrote it would otherwise write the same tail file
    // past the point they share, which a squash merge of the first and a merge of the second cannot
    // settle. That includes a tail no mark speaks of (written before marks were kept): it is asked once,
    // and the first write after it is marked, unless it is the first tail of the repository.
    // A tail the pool offered was asked when it was offered.
    if (
      found !== undefined &&
      this.pool !== undefined &&
      !this.fromPool &&
      lastSegment !== undefined
    ) {
      const here = { root: this.pool.checkoutRoot };
      // The one tail `mnema init` wrote before the repository existed is the exception: see
      // {@link firstTailOfTheRepository}.
      if (
        !wroteOnThisBranch(here, this.tailId, this.pool.branch()) &&
        !firstTailOfTheRepository({
          layout: this.layout,
          shared: this.shared,
          checkout: here,
          tailId: this.tailId,
          fingerprint: this.keyPair.fingerprint,
          pool: this.pool,
        })
      ) {
        const onBase = this.pool.onBase(this.tailId, basename(lastSegment), found.hash);
        if (onBase !== true) {
          const left: NewTail['left'] =
            onBase === undefined ? { offBase: true, unanswered: true } : { offBase: true };
          this.movedOn = { from: this.tailId, to: this.tailId, kept, found, left };
          return;
        }
      }
    }
    // A TAIL THAT HOLDS ENTRIES MAY HAVE BEEN RELINKED, here or by its owner elsewhere, and a
    // relinked tail is frozen at the head the relink names (FORMAT.md section 6.11): an entry more
    // and both readers refuse it (`relinked-tail-grew`). So is a tail that names another record
    // than the one this write joins. Either way the act goes to a new tail, as above.
    if (found !== undefined) {
      const names = namesRelinkedAt(this.layout);
      this.namesRead = names;
      const own = names.named.get(this.tailId);
      const left = names.relinked.has(this.tailId)
        ? { relinked: own as string }
        : this.joins !== undefined && own !== undefined && own !== this.joins
          ? { names: own, joins: this.joins }
          : undefined;
      if (left !== undefined) {
        this.movedOn = { from: this.tailId, to: this.tailId, kept, found, left };
        return;
      }
    }
    // WHAT IS FOUND ABOVE THE COVERAGE IS SIGNED ONLY UNDER AN END THIS INSTALLATION'S SIGNED NOTE
    // VOUCHES FOR (ADR-301, ADR-302). The note above is clear text in the tree, and so is this
    // tail: a party that can write the checkout and cannot use the key rewrote the tail,
    // re-chained it, emptied the checkpoints and fixed the note, and this recovery took every
    // event above the (now absent) coverage as owed a signature, which the next checkpoint gave
    // it. The note that settles it is signed with this tail's key ({@link readWrittenHead}), and
    // the end it is compared with is the end the bytes compute ({@link endAsComputed}), not the
    // hashes stored beside them. Decided before anything is cut or healed, so a write that goes
    // elsewhere or is refused leaves every file of this tail as it found it.
    // `a-history-rewritten-without-the-key-is-never-signed.test.ts` holds each case.
    const above = tip.filter((entry) => entry.link.seq > this.lastCheckpointedSeq).length;
    const computed = endAsComputed(tip, this.lastCheckpointedSeq, this.tailId);
    const vouched = note !== undefined && computed && ownBySignedNote;
    if (vouched) {
      if (
        this.lastCheckpointedSeq < note.coveredThrough ||
        (this.lastCheckpointedSeq === note.coveredThrough &&
          this.lastCheckpointHash !== note.checkpoint)
      ) {
        // Checkpoints this key signed are gone or replaced under an end it vouches for: what
        // they covered would be owed a signature again. Nothing is cut and nothing is signed.
        this.damage = new TailDamagedError(
          this.tailId,
          note.coveredThrough,
          lastComplete,
          this.lastCheckpointedSeq,
        );
        this.nextSeq = this.lastCheckpointedSeq + 1;
        this.pending = [];
        return;
      }
    } else if (above > 0) {
      this.movedOn = {
        from: this.tailId,
        to: this.tailId,
        kept,
        found,
        left: { unvouched: above },
      };
      return;
    } else if (note !== undefined && note.hash !== null && note.seq >= endSeq) {
      // AN END THIS KEY SIGNED FOR IS NOT ON THE DISK, and the clear note says it is (ADR-314): the
      // newest entries were cut, their checkpoints with them, and the clear note set back to what
      // was left. Chained over, the next entry reused a seq this key had already written and
      // signed, and a copy pushed before the cut forked. The clear note is not asked: the end the
      // signed note names is the one this installation wrote last, so the act goes to a new tail.
      this.movedOn = {
        from: this.tailId,
        to: this.tailId,
        kept: { seq: note.seq, hash: note.hash },
        found,
      };
      return;
    }
    this.movedOn = undefined;
    this.keptHash = kept?.hash ?? null;
    this.keptNote = note === undefined ? null : noteSaying(note);
    // Truncates back to the end of the last COMPLETE line, so the next append
    // continues a clean tail instead of landing after the fragment, which
    // would turn a once-benign torn line into a mid-file malformed line that
    // every later read throws on. Above the coverage, a complete append always
    // ends in a newline, so this only ever removes a genuine crash fragment.
    if (lastSegment !== undefined && fragment !== undefined)
      truncateSync(lastSegment, fragment.start);
    healCheckpointsEnd(checkpointsPath(this.layout, this.tailId));
    if (last !== undefined) {
      this.headPrev = last.link.prev;
      this.head = last.link.hash;
      this.nextSeq = last.link.seq + 1;
    }
    // The tip reads whole segments, so it can reach below the coverage; the
    // buffer is only what the next checkpoint must cover.
    this.pending = tip
      .filter((entry) => entry.link.seq > this.lastCheckpointedSeq)
      .map((entry) => entry.written);
  }

  /**
   * Whether this installation has recorded the anchor it serves: the founding
   * (its own) or an enrollment into another. The core founds a fresh
   * installation before its first fact so its events resolve; this lets that
   * check be made without re-reading the tail.
   */
  get hasAnchor(): boolean {
    return signerOf(this.layout, this.keyPair.fingerprint).hasAnchor;
  }

  /**
   * Records the anchor this installation serves, locally and uncommitted. Called
   * by the founding/enrollment operation once, so a later `anchor` read returns
   * the recorded value rather than the derived default.
   */
  recordAnchor(anchor: string): void {
    writeAnchor(this.layout, this.keyPair.fingerprint, anchor);
  }

  /**
   * Appends an event to the tail. Seals the current segment first if it has
   * passed the size cap, so a single entry never straddles two segments. Signs
   * a checkpoint when enough uncheckpointed events have accumulated.
   *
   * Refuses first what no reader could accept ({@link refuseUnreadable}).
   *
   * Indivisible against another process writing this tail: reading the end and
   * appending to it happen under the tail's lock ({@link underTailLock}).
   *
   * @throws {TailBusyError} if another process holds the tail past the wait budget.
   * Nothing is appended.
   */
  append(event: CatalogEvent): Entry {
    return this.underTailLock(() => this.appendLocked(event));
  }

  private appendLocked(handed: CatalogEvent): Entry {
    this.refuseDamagedTail();
    // The citations are read under the lock, so the heads are the ones on disk as this lands.
    const cited = this.cite([handed]);
    const event = cited.event;
    refuseUnreadable(event);
    this.refuseUnprovenWaiver(event);
    this.recordName();
    this.ensureBorn();
    if (this.segmentBytes >= this.maxSegmentBytes) {
      this.segment += 1;
      this.segmentBytes = 0;
    }
    const entry = sealEntry({
      event,
      tail: this.tailId,
      seq: this.nextSeq,
      prev: this.head,
    });
    const line = `${serializeEntry(entry)}\n`;
    const path = segmentPath(this.layout, this.tailId, this.segment);
    this.keepIntent(entry);
    this.holdSigning = false;
    this.landOnTail(path, line, this.segmentBytes);

    this.headPrev = entry.link.prev;
    this.head = entry.link.hash;
    this.nextSeq += 1;
    this.segmentBytes += Buffer.byteLength(line, 'utf-8');
    // Buffered only after the line reached the file: an append that threw must
    // not leave behind an event that a later checkpoint would sign and no reader
    // could ever find.
    this.pending.push(entry.written);
    cited.remember();

    this.signAFoundingOrCap(entry.link.seq);
    return entry;
  }

  /**
   * Appends several events as one atomic unit: either every line reaches the
   * tail or none does. The entries are sealed and chained in memory, serialized
   * together, and written with a SINGLE append, so a birth pair (a
   * `task.created` and its transition) can never land half-written, leaving a
   * created task with no state. A crash mid-write can still tear the LAST line
   * of the buffer, which the reader tolerates as an unterminated final entry, so
   * the atom is "all-or-nothing" up to that already-handled tail case.
   *
   * The whole batch goes into one segment (rotating first if the current one is
   * full), so no entry in the batch straddles a segment boundary.
   *
   * EVERY event is checked against the reader's rule before ANY is sealed
   * ({@link refuseUnreadable}), so a batch whose second event is unreadable does
   * not leave the first one on the tail: the atom holds for the refusal too.
   *
   * The lock is taken ONCE for the whole batch, not once per event, so a birth pair
   * cannot be split by another process any more than it can by a crash.
   *
   * @throws {TailBusyError} if another process holds the tail past the wait budget.
   * Nothing is appended.
   */
  appendAll(events: readonly CatalogEvent[]): Entry[] {
    if (events.length === 0) return [];
    return this.underTailLock(() => this.appendAllLocked(events));
  }

  private appendAllLocked(handed: readonly CatalogEvent[]): Entry[] {
    this.refuseDamagedTail();
    // The batch is one act: its first event cites, and the rest follow it by `seq`.
    const cited = this.cite(handed);
    const events = [cited.event, ...handed.slice(1)];
    for (const event of events) {
      refuseUnreadable(event);
      this.refuseUnprovenWaiver(event);
    }
    this.recordName();
    this.ensureBorn();
    if (this.segmentBytes >= this.maxSegmentBytes) {
      this.segment += 1;
      this.segmentBytes = 0;
    }
    const entries: Entry[] = [];
    let prev = this.head;
    let seq = this.nextSeq;
    let lines = '';
    for (const event of events) {
      const entry = sealEntry({ event, tail: this.tailId, seq, prev });
      const line = `${serializeEntry(entry)}\n`;
      entries.push(entry);
      lines += line;
      prev = entry.link.hash;
      seq += 1;
    }
    const path = segmentPath(this.layout, this.tailId, this.segment);
    this.keepIntent(entries.at(-1) as Entry);
    this.holdSigning = false;
    this.landOnTail(path, lines, this.segmentBytes);

    this.headPrev = (entries.at(-1) as Entry).link.prev;
    this.head = prev;
    this.nextSeq = seq;
    this.segmentBytes += Buffer.byteLength(lines, 'utf-8');
    // Same rule as the single append: buffered only after the write landed.
    for (const entry of entries) this.pending.push(entry.written);
    cited.remember();

    this.signAFoundingOrCap((entries[0] as Entry).link.seq);
    return entries;
  }

  /**
   * Appends `text` to the segment at `path`, which held `before` bytes, and tells a disk that
   * failed it apart from a line that did not land. The call can throw after its bytes are in the
   * file (the sync), so the end of the file decides: where it ends in `text`, the line is on the
   * tail, the write goes on as the success it is, and signing waits for the next append, with the
   * disk's error told as a sentence ({@link recordedNotSigned}); where it does not, nothing landed
   * and the refusal names the errno ({@link WriteNotLandedError}). A batch the disk tore may have left
   * whole entries of it on the tail, so the segment is cut back to its size before the write
   * ({@link cutBack}) for the refusal to be true; where the cut itself fails, the refusal says so.
   */
  private landOnTail(path: string, text: string, before: number): void {
    try {
      appendDurably(path, text);
    } catch (error) {
      if (!endsWith(path, text, before))
        throw new WriteNotLandedError(error, cutBack(path, before));
      this.holdSigning = true;
      this.onUnsigned?.(recordedNotSigned(error));
    }
  }

  /**
   * Refuses to append to a tail whose end falls short of what its last checkpoint signed
   * ({@link TailDamagedError}). First in both append doors, so it runs under the lock, after the
   * recovery that found the damage, and before anything is cited, born or sealed.
   */
  private refuseDamagedTail(): void {
    if (this.damage !== undefined) throw this.damage;
  }

  /** `event` as this writer writes it: citing what it read, when it cites ({@link HeadsToCite}). */
  private cite(events: readonly CatalogEvent[]): Cited {
    return (
      this.heads?.cite(events) ?? { event: events[0] as CatalogEvent, remember: () => undefined }
    );
  }

  /**
   * Refuses a waiver whose claims the disk does not bear out, BEFORE it is sealed.
   *
   * It sits beside {@link refuseUnreadable} and for the same reason (the two
   * append doors are every way onto a tail, so a check here holds for every writing
   * path there is), but it asks a question that function cannot: the rule is about
   * what is on DISK, and only the writer knows the layout and the tail it is landing
   * on. That is also why it is a method and not a free function.
   *
   * IT IS THE WRITE SIDE ONLY, deliberately. The reader's rule cannot include it:
   * a waiver outlives the tail it names, so a read applying this check would refuse
   * the waiver a moment after it became true, and one unreadable line refuses the
   * whole tail forever. See waiver.ts.
   *
   * It THROWS, on the same argument the unreadable refusal throws on: every field it
   * checks is one the writing operation read off the disk itself, so a mismatch means
   * a producer assembled a claim it did not take from the record, a bug here, not an
   * input somebody got wrong.
   */
  private refuseUnprovenWaiver(event: CatalogEvent): void {
    const reason = unprovenWaiverReason({
      layout: this.layout,
      upcasters: this.upcasters,
      event,
      ownTail: this.tailId,
    });
    if (reason === undefined) return;
    throw new EventParseError(
      `refusing to seal a waiver the record does not bear out: ${reason}. This write was not appended.`,
    );
  }

  /**
   * THE WRITE THAT FOUNDS A TAIL SIGNS WHAT IT FOUNDED AT ONCE (ADR-569), before the act goes on;
   * every later write keeps to the ceiling ({@link capUnsignedWindow}) and the act's own end.
   *
   * A clone withholds a tail that holds events and no checkpoint (ADR-561), so a new tail's first
   * act killed after its appends and before the checkpoint that ends it left a tail no clone could
   * read. Signed here, the same kill leaves at most the act's later writes above a checkpoint that
   * holds, which a clone reads as the one write's window. The founding is the write that lands seq
   * 0: a tail is born by it ({@link ensureBorn}), and no later write of the tail lands it again. An
   * act that founds and writes nothing more signs nothing at its end (the buffer is empty); one
   * that goes on pays one signature more. The checkpoint is the one {@link signLocked} always
   * signs: its format, its range rule and its signature are unchanged.
   */
  private signAFoundingOrCap(firstSeq: number): void {
    if (firstSeq === 0) this.signLocked();
    else this.capUnsignedWindow();
  }

  /**
   * Holds the unsigned window under the ceiling: signs a checkpoint once one act of
   * writing has left more than {@link DEFAULT_MAX_UNSIGNED_EVENTS} events above the
   * last one. Coverage stays contiguous: each checkpoint starts at the seq right
   * after the previous one's end.
   *
   * It is NOT the product's cadence and does not set it. Every writing path signs
   * what it wrote before it returns, which is a far tighter rule than this one and is
   * guarded separately (`every-write-signs-what-it-wrote.test.ts`). What this catches
   * is the act too big to wait for: a bulk import, a session serving a long list of
   * patterns. Without it, one act could put an unbounded number of events on the tail
   * with nothing signed until the end, and a crash halfway would leave every one of
   * them resting on the hash chain alone.
   */
  private capUnsignedWindow(): void {
    const uncovered = this.nextSeq - 1 - this.lastCheckpointedSeq;
    if (uncovered < this.maxUnsignedEvents) return;
    // {@link signLocked}, never the public {@link checkpoint}: this runs from inside
    // an append that is already holding the tail's lock, and the lock does not nest.
    this.signLocked();
  }

  /**
   * Signs a checkpoint over every uncheckpointed event now. Public so a caller
   * can force a checkpoint (e.g. at shutdown) to shrink the uncovered window.
   *
   * The events signed come from the writer's own buffer, never from a re-read of
   * the tail. The buffer is asserted against the range first: a checkpoint claims
   * `[fromSeq..toSeq]`, so signing a content root over a set that is not exactly
   * that range would be a silent break of the proof; a verifier recomputing the
   * root from the bytes would then read an honest tail as tampered. It refuses
   * loudly instead, through {@link assertBufferCoversRange}. No legitimate use reaches
   * that refusal: the buffer is appended to on every successful write and is emptied by a
   * signature or rebuilt from the disk by recovery, AND the coverage it reads is brought back
   * in line with the disk under the lock first, so a range another process has already signed
   * is not signed a second time. The test of that function in `writer.test.ts` is what holds
   * it, and it also holds that signing calls it.
   *
   * @throws {TailBusyError} if another process holds the tail past the wait budget.
   * Nothing is signed.
   */
  checkpoint(): Checkpoint | null {
    // NOTHING TO SIGN TAKES NO LOCK. A write signs inside the hold that wrote it, and a caller
    // that signs once more afterwards (to cover a founding it cannot see, say) would otherwise
    // queue for the lock a second time with its fact already on the tail: refused there, it
    // reported "not appended" about a fact that was. With nothing of this writer's unsigned and
    // the tail's files exactly where its last hold left them, there is provably nothing to sign
    // (the buffer is every event above the last checkpoint, as of that hold), so the answer is
    // the one the lock would have given, without asking for it. A tail that moved since, or a
    // writer that never held it, still goes through the lock and signs what it finds.
    if (!this.holding && this.pending.length === 0 && this.unmovedSinceLastHold()) return null;
    return this.underTailLock(() => this.signLocked());
  }

  private unmovedSinceLastHold(): boolean {
    const now = this.readMark();
    return (
      now.segmentBytes === this.mark.segmentBytes &&
      now.nextSegment === this.mark.nextSegment &&
      now.checkpointBytes === this.mark.checkpointBytes &&
      now.firstBytes === this.mark.firstBytes &&
      now.note === this.mark.note
    );
  }

  private signLocked(): Checkpoint | null {
    // A tail with no beginning is signed over by nobody: what is above its coverage is not a range
    // a checkpoint may claim. (A cut end signs nothing already, as nextSeq stops at the coverage.)
    if (this.damage?.startsAt !== undefined) throw this.damage;
    // A line whose sync failed was told as not yet signed: it is signed by the next append.
    if (this.holdSigning) return null;
    const fromSeq = this.lastCheckpointedSeq + 1;
    const toSeq = this.nextSeq - 1;
    if (toSeq < fromSeq) return null;
    assertBufferCoversRange(this.tailId, fromSeq, toSeq, this.pending);
    const checkpoint = signCheckpoint({
      tail: this.tailId,
      fromSeq,
      events: this.pending,
      prev: this.lastCheckpointHash,
      keyPair: this.keyPair,
      record: this.recordName(),
    });
    const path = checkpointsPath(this.layout, this.tailId);
    ensureDir(path);
    const line = `${serializeCheckpoint(checkpoint)}\n`;
    const before = Math.max(0, sizeOf(path));
    try {
      appendDurably(path, line);
    } catch (error) {
      // The events are on the tail already, so this is not a write that failed. Where the line
      // is not at the file's end the checkpoint did not land: the buffer stays intact, the state
      // stays as it was, and the next write signs the same range. Where it is, it landed and
      // only its sync failed, which is told as that.
      if (!endsWith(path, line, before)) {
        this.onUnsigned?.(recordedNotSigned(error));
        return null;
      }
      this.onUnsigned?.(signatureNotConfirmed(error));
    }
    // Advanced only after the checkpoint reached the file, so a failed append
    // leaves the buffer intact and a retry signs the same range again.
    this.lastCheckpointedSeq = toSeq;
    this.lastCheckpointHash = checkpointHash(checkpoint);
    this.pending = [];
    return checkpoint;
  }
}

/**
 * Refuses, before anything is signed, a buffer that does not hold as many events as the range a
 * checkpoint is about to claim: a content root over any other set of events would be a silent
 * break of the proof.
 *
 * It checks the COUNT: `pending` must hold `toSeq - fromSeq + 1` events. A buffer of the right
 * size whose events are other seqs than the range passes, and is outside what this function
 * confirms.
 *
 * No legitimate use reaches the refusal: the buffer grows on every successful write and is emptied
 * by a signature or rebuilt from the disk by recovery, and the coverage is brought back in line
 * with the disk under the lock first. It stays as a last line, and `writer.test.ts` holds this
 * function directly (the range covered, one event short, one over, an empty buffer) and holds that
 * `signLocked` calls it.
 *
 * @throws {Error} when `pending` does not hold exactly `toSeq - fromSeq + 1` events.
 */
export function assertBufferCoversRange(
  tail: string,
  fromSeq: number,
  toSeq: number,
  pending: readonly unknown[],
): void {
  const covered = toSeq - fromSeq + 1;
  if (pending.length !== covered) {
    throw new Error(
      `chain: refusing to sign a checkpoint over ${tail} seq ${fromSeq}..${toSeq}: ` +
        `the range covers ${covered} event(s) but ${pending.length} are buffered`,
    );
  }
}

/**
 * A tail whose end on disk falls short of what its last checkpoint signed: the last complete
 * line is below the checkpoint's `toSeq`; a signed line was cut, lost its newline, or is gone.
 *
 * A crash cannot leave a tail in this state. A line reaches its segment, newline and all, in one
 * durable append, and only then can a checkpoint sign it; so the only unterminated piece a crash
 * leaves is ABOVE the coverage, and that one the writer still cuts off and writes past. Below the
 * coverage the bytes are something else (an edit, a bad merge, a disk) and they are evidence:
 * `verify` fails on a cut or missing signed line. Cutting them back to the last newline erased that
 * evidence, chained the next event to a seq the checkpoint had already signed, and then failed
 * to sign it, so the write reported a failure about a fact that had landed. A signed line that
 * only lost its newline is read whole by both readers, and was cut all the same.
 *
 * So it is a REFUSAL, thrown by both append doors under the tail's lock and before anything is
 * sealed, and the tail is left byte for byte as it was found.
 */
export class TailDamagedError extends CodedError {
  readonly code = 'TAIL_DAMAGED';

  constructor(
    readonly tail: string,
    readonly signedThrough: number,
    readonly lastComplete: number,
    /**
     * Set when the lines are whole and it is the CHECKPOINTS that fell short (ADR-302): the
     * `toSeq` of the last one on disk (-1 for none), below or beside the coverage the note this
     * installation signed says this key signed ({@link readWrittenHead}).
     */
    readonly checkpointsEndAt?: number,
    /** Set when the tail's first line is not seq 0: the seq it begins at. */
    readonly startsAt?: number,
  ) {
    super(tailDamage(tail, signedThrough, lastComplete, checkpointsEndAt, startsAt));
    this.name = 'TailDamagedError';
  }
}

/** The sentence a {@link TailDamagedError} says, by what fell short: a line, or the checkpoints. */
function tailDamage(
  tail: string,
  signedThrough: number,
  lastComplete: number,
  checkpointsEndAt: number | undefined,
  startsAt?: number,
): string {
  if (startsAt !== undefined) {
    return (
      `this machine's tail ${tail} begins at seq ${startsAt} and not at seq 0: the start of the ` +
      'tail is missing (its first segment file), which no crash leaves. This write was not ' +
      'appended, and the tail was left as it was. A read of the record shows it as a seq gap: ' +
      'compare its files with the last copy you trust (the repository, a backup) and put them ' +
      'back before writing again.'
    );
  }
  if (checkpointsEndAt !== undefined) {
    const now =
      checkpointsEndAt < 0
        ? 'it holds no checkpoint now'
        : checkpointsEndAt < signedThrough
          ? `its checkpoints now end at seq ${checkpointsEndAt}`
          : 'its last checkpoint, through that seq, is not the one this key signed';
    return (
      `this machine's tail ${tail} was signed by this key through seq ${signedThrough}, as the ` +
      `note this installation signed when it last wrote there says, and ${now}: checkpoints ` +
      'this key signed were taken out or replaced, which no crash leaves. This write was not ' +
      'appended, nothing was signed, and the tail was left as it was. The events above the ' +
      'checkpoints that remain are not signed again: compare its files with the last copy you ' +
      'trust (the repository, a backup) and put them back before writing again.'
    );
  }
  const found =
    lastComplete < 0 ? 'no complete line' : `its last complete line is seq ${lastComplete}`;
  return (
    `this machine's tail ${tail} is signed through seq ${signedThrough}, and ${found}: a line ` +
    'its last checkpoint signed is cut, is missing or has lost its newline, which no crash ' +
    'leaves. This write was not appended, and the tail was left as it was. `mnema verify` fails ' +
    'on a signed line that is cut or missing, and passes on a signed line that only lost its ' +
    'newline, so a pass does not clear this tail: compare its files with the last copy you ' +
    'trust (the repository, a backup) and put them back before writing again.'
  );
}

/**
 * The seq of the first line the tail holds, or undefined where there is none to read (no segment,
 * every segment empty or unfinished, a first line that does not parse or that is longer than
 * {@link FIRST_LINE_LIMIT}, or a segment that vanished between the listing and the open: other
 * refusals say those). A first segment that is empty or whose first line was never finished,
 * with segments after it, is a start that is gone, so the walk goes on to the first line of the
 * next one and the seq it begins at says so. Each file is read in small pieces up to its first
 * newline, never past the limit.
 */
function firstSeqOfTheTail(
  layout: ChainLayout,
  tailId: string,
  upcasters: UpcasterRegistry,
): number | undefined {
  for (const segment of orderedSegments(layout, tailId)) {
    const line = firstLineOf(segment);
    if (line === 'unfinished') continue;
    if (line === undefined) return undefined;
    try {
      return parseEntry(line, upcasters).link.seq;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/** The most of a first line that is read: a longer one is no entry. */
const FIRST_LINE_LIMIT = 1 << 20;

/**
 * The first line of a file, `'unfinished'` for a file that is empty or ends before a newline, and
 * undefined for one that cannot be read or whose first line passes {@link FIRST_LINE_LIMIT}.
 */
function firstLineOf(file: string): string | undefined | 'unfinished' {
  let fd: number | undefined;
  try {
    fd = openSync(file, 'r');
    const chunk = Buffer.alloc(8192);
    const parts: Buffer[] = [];
    let at = 0;
    while (at < FIRST_LINE_LIMIT) {
      const read = readSync(fd, chunk, 0, chunk.length, at);
      if (read === 0) return 'unfinished';
      const newline = chunk.subarray(0, read).indexOf(0x0a);
      if (newline >= 0) {
        parts.push(Buffer.from(chunk.subarray(0, newline)));
        return Buffer.concat(parts).toString('utf-8');
      }
      parts.push(Buffer.from(chunk.subarray(0, read)));
      at += read;
    }
    return undefined;
  } catch {
    return undefined;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

/**
 * The damage the tail of this installation shows, asked of the disk and of nothing else: no
 * writer is opened, no lock is taken and no file is written, so a command that only says what a
 * write would say (`mnema init`) can ask it and leave the machine as it found it. Undefined where
 * there is no damage to name: no installation id kept, a tail that is not there at all, or one
 * whose files end where its checkpoints say and begin at seq 0.
 *
 * It is the same rule the writer's recovery applies ({@link damageInTheFiles}): the end of the
 * tail short of what its last checkpoint signed, and a start above seq 0. It does not name what
 * the writer names from a signed note of this key's last write (checkpoints taken out or replaced
 * under a whole end): that one needs the key's note. For a tree that holds no installation id of
 * this key it returns undefined silently; only the public `init` asks it today. A first line it
 * cannot parse is the readers' to refuse and throws from here as it does from them.
 */
export function readTailDamage(
  layout: ChainLayout,
  fingerprint: string,
  upcasters: UpcasterRegistry,
  installation: ChainLayout = layout,
): TailDamagedError | undefined {
  // The hint a worktree keeps first; the id an earlier mnema kept in the record, until the first
  // write of this one moves it.
  for (const place of [installation, layout]) {
    let installationId: string;
    try {
      installationId = readFileSync(installationIdPath(place, fingerprint), 'utf-8').trim();
    } catch {
      continue;
    }
    if (installationId === '') return undefined;
    return readTailDamageOf(layout, `${fingerprint}-${installationId}`, upcasters);
  }
  return undefined;
}

/** {@link readTailDamage} for a tail already named: the one a writer opened over is `writer.tail`. */
export function readTailDamageOf(
  layout: ChainLayout,
  tailId: string,
  upcasters: UpcasterRegistry,
): TailDamagedError | undefined {
  if (!existsSync(tailDir(layout, tailId))) return undefined;
  const lastCp = lastTailCheckpoint(layout, tailId);
  const end = readEndOfTheTail(layout, tailId, upcasters, lastCp);
  return damageInTheFiles(layout, tailId, upcasters, lastCp, end);
}

/** What the end of a tail holds: the segment it ends in, the torn piece, and the entries read. */
interface EndOfTheTail {
  readonly lastSegment: string | undefined;
  readonly fragment: TornFragment | undefined;
  /** The walk from the end down to the coverage, a fragment that parses included. */
  readonly walked: ChainEntry[];
  /** `walked` without a fragment that parses: the lines the tail holds. */
  readonly tip: ChainEntry[];
  readonly lastComplete: number;
}

/** The clear note of a tail as it is on the disk, or null for none. */
function noteOf(shared: ChainLayout, tailId: string): string | null {
  try {
    return readFileSync(keptHeadPath(shared, tailId), 'utf-8');
  } catch {
    return null;
  }
}

/** Reads the end of a tail from its files; the writer's recovery and the read-only ask both use it. */
function readEndOfTheTail(
  layout: ChainLayout,
  tailId: string,
  upcasters: UpcasterRegistry,
  lastCp: Checkpoint | undefined,
): EndOfTheTail {
  const lastSegment = orderedSegments(layout, tailId).at(-1);
  const fragment = lastSegment === undefined ? undefined : tornFragment(lastSegment, upcasters);
  const coverage = lastCp?.toSeq ?? -1;
  // A fragment that parses is the walk's first entry and not a line the tail holds, so the
  // walk goes one entry further down to still reach the coverage without it.
  const walked = readTailTip(layout, tailId, upcasters, coverage - (fragment?.parses ? 1 : 0));
  const tip = fragment?.parses ? walked.slice(0, -1) : walked;
  return { lastSegment, fragment, walked, tip, lastComplete: tip.at(-1)?.link.seq ?? -1 };
}

/**
 * THE ONE RULE FOR WHAT THE FILES OF A TAIL SHOW AS DAMAGE, asked by the writer's recovery
 * (under the lock, after its resync) and by {@link readTailDamage} (from the disk alone): a last
 * complete line below what the last checkpoint signed, or a first segment that does not begin at
 * seq 0 (`tail prune` removes a tail whole and never a segment). The only damage it does not
 * name is the one that needs this key's signed note: checkpoints taken out or replaced under a
 * whole end, which `recover()` alone names.
 */
function damageInTheFiles(
  layout: ChainLayout,
  tailId: string,
  upcasters: UpcasterRegistry,
  lastCp: Checkpoint | undefined,
  end: EndOfTheTail,
): TailDamagedError | undefined {
  if (lastCp !== undefined && end.lastComplete < lastCp.toSeq) {
    return new TailDamagedError(tailId, lastCp.toSeq, end.lastComplete);
  }
  const startsAt = firstSeqOfTheTail(layout, tailId, upcasters);
  if (startsAt !== undefined && startsAt !== 0) {
    return new TailDamagedError(tailId, lastCp?.toSeq ?? -1, end.lastComplete, undefined, startsAt);
  }
  return undefined;
}

/**
 * A write into a directory that holds tails of two records, or from a tail of another record
 * than the rest (FORMAT.md section 6.10): what both readers refuse as `another-record`, which
 * growing would only grow. Thrown under the tail's lock and before anything is born or sealed.
 */
export class AnotherRecordError extends CodedError {
  readonly code = 'ANOTHER_RECORD';

  constructor(
    readonly tail: string,
    readonly refusal: Exclude<WriteUnder, { readonly name: string }>,
  ) {
    super(`${anotherRecordSaid(tail, refusal)} This write was not appended.`);
    this.name = 'AnotherRecordError';
  }
}

/** What {@link AnotherRecordError} says, by its refusal. */
function anotherRecordSaid(
  tail: string,
  refusal: Exclude<WriteUnder, { readonly name: string }>,
): string {
  // WHICH OF THE TWO WAS HERE FIRST IS NOT SAID: measured on the binary, a tail grafted into a
  // record beside this machine's own one reads this way from this machine's side, and the graft
  // is the newcomer there. A directory alone does not tell (FORMAT.md section 6.10).
  if (refusal.refused === 'foreign') {
    return (
      `this machine's tail ${tail} names record ${refusal.own.slice(0, 12)}..., and the other ` +
      `tails here that name a record name ${refusal.record.slice(0, 12)}...: this directory ` +
      'holds tails of two records (a tail grafted from another record, or two records an ' +
      '`mnema init` began on two branches and a merge joined), which `mnema verify` refuses ' +
      '(another-record).'
    );
  }
  const groups = refusal.groups
    .map(({ name, tails }) => `${name.slice(0, 12)}... (${tails.join(', ')})`)
    .join(' and ');
  return (
    `the tails of this record name ${refusal.groups.length} records, ${groups}: a tail grafted ` +
    'from another record, or two records merged, which `mnema verify` refuses (another-record).'
  );
}

/**
 * Refuses an event that no reader could accept, BEFORE it is sealed.
 *
 * This is the narrowest point there is. An entry reaches a tail through exactly
 * two doors, {@link ChainWriter.append} and {@link ChainWriter.appendAll}, so a
 * check here holds for every writing path that exists and every one that will be
 * added, including one written by a caller outside this workspace. The rule it
 * applies is not a rule of its own: {@link unreadableReason} IS the reader's
 * validator, so "the writer refuses exactly what the reader refuses" is a property
 * of the code and not a discipline anybody has to keep.
 *
 * It matters because the failure it closes is unrecoverable. An unreadable entry
 * on an append-only log cannot be taken back, and the replay refuses the whole
 * tail rather than the one line, so a single empty title left every later read of
 * that project (every search, every show, every timeline) failing forever while
 * the write reported success.
 *
 * It THROWS, and that is deliberate: reaching it means a producer built an event
 * its own catalog forbids, which is a bug in this codebase, not an input a person
 * got wrong. The surfaces ask {@link unreadableReason} themselves and turn the
 * same answer into a typed refusal, so an ordinary bad input is reported and
 * costs nothing; this is the floor under that, for the caller that forgot to ask.
 */
function refuseUnreadable(event: CatalogEvent): void {
  const reason = unreadableReason(event);
  if (reason === undefined) return;
  throw new EventParseError(
    `refusing to seal an event no reader could accept: ${reason}. This write was not appended.`,
  );
}

/**
 * Whether the proof file at `path` is empty or is not JSON at all, which is what a cut leaves. A
 * file that cannot be read is left to whoever reads it, and one that is JSON is left whole, whoever's
 * it is and however it is spelled: a reformatted proof is for the readers to name (ADR-354).
 */
function unreadableProof(path: string): boolean {
  let text: string;
  try {
    text = readFileSync(path, 'utf-8');
  } catch {
    return false;
  }
  return text.trim() === '' || !isJsonText(text);
}

/**
 * A file's size in bytes, or -1 if it is not there.
 *
 * Absent and empty have to be TOLD APART here (a segment that does not exist yet and
 * one a recovery truncated to nothing are different states of the tail), so the
 * answer is a number a size can never be, not a zero that both would produce.
 */
function sizeOf(filePath: string): number {
  try {
    return statSync(filePath).size;
  } catch {
    return -1;
  }
}

/**
 * Cuts the segment at `path` back to the `before` bytes it held, durably, and says whether it did.
 * What a failed append left (an unfinished line, or the whole entries of a batch it tore) is not
 * the fact, and a refusal that promises nothing was written has to be true of the file. A segment
 * that was never created (the open itself failed) holds nothing to cut, so it counts as cut.
 */
function cutBack(path: string, before: number): boolean {
  if (!existsSync(path)) return true;
  let fd: number | undefined;
  try {
    truncateSync(path, before);
    fd = openSync(path, 'r+');
    fsyncSync(fd);
    return true;
  } catch {
    return false;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

/** Whether the file at `path`, which held `before` bytes, now ends in exactly `text`. */
function endsWith(path: string, text: string, before: number): boolean {
  const bytes = Buffer.from(text, 'utf-8');
  let fd: number | undefined;
  try {
    fd = openSync(path, 'r');
    if (fstatSync(fd).size !== before + bytes.length) return false;
    const found = Buffer.alloc(bytes.length);
    return readSync(fd, found, 0, bytes.length, before) === bytes.length && found.equals(bytes);
  } catch {
    return false;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

function ensureDir(filePath: string): void {
  const dir = dirname(filePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

/**
 * Heals the end of `checkpoints.jsonl` the way the segment's is healed: a last line with no
 * newline is a crash's piece, and the next checkpoint appended after it would glue to it and
 * make the file unreadable for good. A piece that does not parse is cut at its start; one that
 * parses lost only its newline and is completed, because `lastTailCheckpoint` already counts it
 * as the tail's last checkpoint and the next one links to it. Under the tail lock, like the cut
 * of the segment, and only on a tail this installation goes on writing.
 */
function healCheckpointsEnd(path: string): void {
  if (!existsSync(path)) return;
  for (const line of linesFromEnd(path)) {
    if (line.bytes.length === 0) return; // ends in a newline: intact
    const parses = parseStoredLine(line.bytes, true, parseCheckpoint, () => path) !== null;
    if (parses) appendDurably(path, '\n');
    else truncateSync(path, line.start);
    return;
  }
}

/** The unterminated piece a segment ends in: where it begins, and whether it reads as an entry. */
interface TornFragment {
  /** The byte after the segment's last newline, where a cut leaves the segment. */
  readonly start: number;
  /** Whether the piece parses: a line that lost only its newline does. */
  readonly parses: boolean;
}

/**
 * A segment's torn trailing fragment, or undefined when the segment ends in a newline (or is
 * empty). It reads; it does not cut: whether the piece may be cut is the coverage's to say
 * (`recover()`).
 *
 * It asks the backward walk for the file's LAST line and needs nothing else: an
 * intact file answers with the empty line that a trailing newline leaves, and a
 * torn one answers with the fragment, whose offset is where to cut. One chunk,
 * whatever the segment weighs: reading it whole would put the segment's full size
 * back on every single write.
 *
 * Works in bytes, not characters: the offset is the byte after the last `\n`, so
 * a multi-byte UTF-8 character split across the crash boundary is removed whole
 * with the rest of the fragment. The piece is parsed the way the tip parses it, so
 * "it parses" means the tip took it as an entry.
 */
function tornFragment(segmentPath: string, upcasters: UpcasterRegistry): TornFragment | undefined {
  for (const line of linesFromEnd(segmentPath)) {
    if (line.bytes.length === 0) return undefined; // ends in a newline: intact
    const read = parseStoredLine(
      line.bytes,
      true,
      (text) => parseEntry(text, upcasters),
      () => segmentPath,
    );
    return { start: line.start, parses: read !== null };
  }
  return undefined; // an empty file: nothing torn
}

/** The signed note as one string, to tell whether the one to keep is the one already kept. */
function noteSaying(note: WrittenHead): string {
  const next = note.next === null ? null : `${note.next.seq}:${note.next.hash}`;
  return [note.seq, note.hash, note.prev, note.coveredThrough, note.checkpoint, next].join(' ');
}

/**
 * Whether the entries of `tip` above `coveredThrough` are what their bytes compute: each one's
 * entry hash taken again over its written event, its tail, its seq and the hash of the entry
 * before it, with each seq the one before plus one, starting from the entry AT the coverage (or
 * from seq 0 and no predecessor when nothing is covered).
 *
 * The reading takes the stored hashes on trust (`parseEntry` does not check the chain), and a
 * checkpoint signs a root over event content alone, so an event edited with its stored hashes
 * kept matches every hash the recovery compares. A signed note vouches for an end; this is what
 * makes the end it vouches for the end of these bytes. It costs the entries above the coverage,
 * which are usually none.
 */
function endAsComputed(tip: readonly ChainEntry[], coveredThrough: number, tail: string): boolean {
  let at = tip.length - 1;
  while (at >= 0 && (tip[at] as ChainEntry).link.seq > coveredThrough) at -= 1;
  let prev: string | null = null;
  if (coveredThrough >= 0) {
    const boundary = tip[at];
    if (boundary === undefined || boundary.link.seq !== coveredThrough) return false;
    prev = boundary.link.hash;
  }
  let seq = coveredThrough + 1;
  for (const entry of tip.slice(at + 1)) {
    if (entry.link.seq !== seq || entry.link.prev !== prev || entry.link.tail !== tail)
      return false;
    if (!entryHashHolds(entry)) return false;
    prev = entry.link.hash;
    seq += 1;
  }
  return true;
}
