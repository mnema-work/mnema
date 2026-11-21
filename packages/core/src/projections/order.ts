/**
 * Reading every tail of a chain's RECORD into ONE deterministic, total order of events:
 * the input a projection replays.
 *
 * IT SAID "every tail of a chain", and the directory held more than its record. A tail of
 * another record, copied with its key into this directory, verified on its own and was read as
 * this record's: its decisions governed here. Both readers refuse such a directory
 * (`another-record`), but a projection runs over one nobody verified, so the tails it reads are
 * the ones `tailsReadAt` (`@mnema/chain`) gives: every tail of a directory whose tails name one
 * record or none, and NONE of a directory whose tails name two, in the order, the frontier and the
 * catch-up alike (`code/tests/a-directory-of-two-records-governs-nothing.test.ts`).
 *
 * The chain is per-tail by design: each machine appends to its own tail, and
 * there is NO global order across tails (that is what makes an offline merge a
 * no-op instead of a conflict). What there is, when a writer had read another
 * tail, is its word for it: the envelope's `after` names the heads it had read.
 * Three rules govern the merge:
 *
 *   - WITHIN a tail, `seq` is the true order and the hash chain proves it. That
 *     order is NEVER reordered, not even when a tail's own `at` values are not
 *     monotonic (a clock that steps back between two appends must not move a
 *     later-sequenced fact earlier). The proof, not the wall-clock, defines
 *     within-tail order.
 *   - A CITATION is honoured: an event is not taken before what its `after`
 *     names. A writer only cites what it had read, so this is the one piece of
 *     true order across tails the record carries, and it holds whatever the
 *     clocks said.
 *   - ACROSS tails otherwise, no true order exists, so the merge picks a
 *     convention. The only thing a cache needs is that it is TOTAL and
 *     DETERMINISTIC: the same tails always fold to the same order, so a rebuild
 *     reproduces the same state every time.
 *
 * So this is a k-way merge of per-tail streams, each already in `seq` order:
 * the chain's own {@link causalOrder}, the merge the verifier's enrolment fold
 * walks too. At each step it takes, among the tails whose next event cites
 * nothing not yet taken, the one whose next event has the smallest `at`,
 * breaking ties by the tree's position (as a number) and then the tail id.
 * The tail id is all there is to break on in one tree: two heads of one tail never meet,
 * because `seq` has already put them in order. `at` is only ever compared BETWEEN the heads of
 * different tails (an approximate, human-legible interleaving hint) and never
 * within a tail, so it can never override the proven order. A plain global sort
 * by `(at, tail, seq)` would break that: a non-monotonic `at` inside one tail
 * would reorder that tail against its own proof.
 *
 * What this order does NOT do: decide who "wins" when two tails concurrently
 * move the same entity. That is a real race, and resolving it (last-writer,
 * merge policy, conflict surfacing) is the domain's concern, layered on top.
 * This only guarantees the replay is deterministic and faithful to each tail's
 * proven order.
 *
 * WHAT IT DOES LEAVE OUT: a move the workflow does not allow (FORMAT.md §6.7), and a writing of a
 * decision that comes before the text its first judgment saw (§6.8). Every reader
 * judges the moves of the merged order by the same tables ({@link illegalMoves}) and applies
 * none it refuses, so the order a projection folds is the record without them. A move left
 * out here is left out of every fold, the reference index and the divergences alike (which is
 * what "not applied" means) and `verify` names it in its census.
 */

import {
  type CatalogEvent,
  type ChainEntry,
  type ChainLayout,
  type CheckpointsMark,
  type CommittedKeys,
  causalOrder,
  checkpointBelongsToItsTail,
  checkpointHash,
  checkpointSignatureHolds,
  committedKeys,
  DEFAULT_MAX_UNSIGNED_EVENTS,
  decisionTexts,
  firstLinkBreakFrom,
  foldCheckpoints,
  illegalMoves,
  isCatalogEvent,
  keysTheDiskRefuses,
  type LinkBreak,
  lastTailCheckpoint,
  orderedSegments,
  type ProvenOnTail,
  precedesItsText,
  type RecordGroup,
  type RefusedLine,
  type RefusedPart,
  type RetainedEntry,
  readTail,
  readTailCheckpointsMarked,
  readTailCheckpointsSince,
  readTailSince,
  readWrittenHead,
  refusedPartOf,
  ruleOnCheckpoint,
  subjectEvents,
  type TailBoundary,
  tailFingerprint,
  tailsReadAt,
  type UnreadEvent,
  type UnreadLine,
  type UpcasterRegistry,
  unreadLinesOf,
  type WithheldRun,
} from '@mnema/chain';
import { notesRootOf } from '../topology/git-place.js';

/**
 * What a reading collects of the parts of the record it SERVES AROUND: a collector to hand to the
 * readers (`readTail`, `readTailSince`, `tailsReadAt`) and the parts it was handed, each once (a
 * link is met by more than one listing of the same directory). The reading serves what it reads and
 * the parts say what it did not (FORMAT.md section 7.1); the line after a refused one breaks the
 * chain as it always did.
 */
function refusedParts(): { readonly collect: RefusedLine; readonly parts: RefusedPart[] } {
  const parts: RefusedPart[] = [];
  return {
    parts,
    collect: (error, line, start) => {
      const part = refusedPartOf(error, line, start);
      if (!parts.some((held) => sameRefusedPart(held, part))) parts.push(part);
    },
  };
}

function sameRefusedPart(a: RefusedPart, b: RefusedPart): boolean {
  return a.kind === b.kind && a.place === b.place && a.line === b.line;
}

/**
 * What a reading of one tail contributed, and where it left off: the shape both the
 * resumed reading and the whole one answer in, so {@link chainArrivals} has one case.
 */
interface ReadSoFar {
  /** Every line past where the reading started, the retained included: the chain is measured over them. */
  readonly arrivals: readonly ChainEntry[];
  /** The arrivals whose hash holds: the ones the order is made of. */
  readonly served: readonly ChainEntry[];
  /** The arrivals left out of {@link served}. */
  readonly retained: readonly RetainedEntry[];
  readonly boundary: TailBoundary | undefined;
}

/**
 * One tail's events in proven (`seq`) order, with their entry hashes. `tree` and `tail`
 * are what ties break on, in that order: the tree's position in the list a caller gave
 * (0 for a single chain), compared as a NUMBER, and then the tail id, so two trees that
 * happen to share a tail id (the same person's key installs into each) still merge to one
 * stable order, and the eleventh tree listed sorts after the second.
 */
interface TailStream {
  readonly tree: number;
  /**
   * Every line of the tail, by position, those of a kind this binary does not know included
   * (ADR-113): they take their place in the merge, by their `at` and their citations, and are
   * left out of what the merge hands a projection ({@link mergeStreams}).
   */
  readonly events: readonly (CatalogEvent | UnreadEvent)[];
  /** The entry hash of each event, by position: what a citation names. */
  readonly hashes: readonly string[];
  /**
   * The tail this stream came from, and the last `seq` it held when it was read.
   * The merge reads neither: they are what {@link ChainFrontier} is made of, and
   * they ride along here so learning them costs no second reading of the tail.
   * `lastSeq` is -1 for a tail that holds nothing.
   */
  readonly tail: string;
  readonly lastSeq: number;
  /**
   * The hash of the last entry read from this tail, or null for a tail that held none:
   * what the next entry has to name as its `prev`. It rides along for the same reason
   * `lastSeq` does: the reading had it in hand.
   */
  readonly lastHash: string | null;
  /**
   * Where the reading of this tail stopped, in bytes: undefined for a tail that held
   * nothing. It rides along for the same reason `lastSeq` does: the reading had it.
   */
  readonly boundary?: TailBoundary;
  /** Where this tail stopped chaining, if it did: carried with the reading of it. */
  readonly linkBreak?: LinkBreak;
  /** The lines of this tail of a kind this binary does not know: what the reading read past. */
  readonly unread: readonly UnreadLine[];
  /** The lines of this tail whose hash does not hold, which `events` leaves out. */
  readonly retained: readonly RetainedEntry[];
  /**
   * What the tail's checkpoints proved, when the reading folded them ({@link chainReplay}): the
   * facts said of it, and where the folding of `checkpoints.jsonl` stopped.
   */
  readonly signed?: { readonly facts: readonly SignedFact[]; readonly reach: TailSignedReach };
}

/**
 * Where a reading finds the signed notes of what this machine wrote (ADR-560): the root whose
 * `locks/` holds them, which inside a repository is the place every worktree shares for the public
 * tree (`WriterOptions.sharedRoot`). Absent, the tree's own `locks/` is read, which is where a
 * writer outside a repository keeps them. A note is verified with the tail's own committed key,
 * bound to its fingerprint as a checkpoint's is: it is no weaker than the checkpoints it stands in
 * for, and a note that is absent or does not verify proves nothing.
 */
export interface ReadProof {
  readonly notesRoot?: string;
}

/**
 * What a reading says of one tail's signatures (ADR-557 to ADR-562). `withheld` is Fact A: the
 * run was not served, and the gate and every write refuse while it stands. `unsigned` is Fact B:
 * the run is served and listed as such and governs nothing (or, `byNote`, governs because this
 * machine's signed note vouches for it).
 */
export interface SignedFact {
  readonly tail: string;
  readonly withheld?: WithheldRun;
  readonly unsigned?: {
    readonly fromSeq: number;
    readonly toSeq: number;
    readonly count: number;
    readonly byNote: boolean;
  };
}

/**
 * How far a tail's `checkpoints.jsonl` was folded, for a catch-up to take only the new lines.
 * `clean` is true when every event read was proven by a holding checkpoint: only then is a
 * catch-up a suffix, and otherwise the record is read whole again.
 */
export interface TailSignedReach {
  readonly clean: boolean;
  readonly mark: CheckpointsMark;
  /** The hash of the last checkpoint line folded, or null for none. */
  readonly prev: string | null;
  /** The last seq a checkpoint line covered, or -1. */
  readonly covered: number;
}

/**
 * Reads the record's tails and merges them into one total, deterministic order. This is
 * the single bridge from the chain to a projection: a projection consumes this
 * ordered stream and never reads tails itself.
 */
export function orderedEvents(
  layout: ChainLayout,
  upcasters: UpcasterRegistry,
  serveAround = false,
): CatalogEvent[] {
  return chainReplay(layout, upcasters, serveAround).events;
}

/**
 * {@link orderedEvents} and the lines of a kind this binary does not know that the same reading
 * read past: one reading, two answers, for a read that says where a newer mnema wrote and must
 * not fold the tails a second time to learn it.
 */
export function orderedEventsAndUnread(
  layout: ChainLayout,
  upcasters: UpcasterRegistry,
): { readonly events: CatalogEvent[]; readonly unread: readonly UnreadLine[] } {
  const { events, unread } = chainReplay(layout, upcasters);
  return { events, unread };
}

/**
 * How far one tail was read: the last position proven, and the segment files that
 * held it.
 *
 * BOTH, because they answer different questions and only one of them is about
 * growth. `lastSeq` says where to resume from, and -1 says the tail held nothing.
 * `segments` is what catches the chain SHRINKING: a tail's earlier segments are
 * sealed and never reopened, so the list only ever gains entries at the end, and a
 * list that is no longer a prefix of the tail's list is a tail that was cut, which is
 * the one change no suffix can describe.
 *
 * That second half also closes a hole the growth probe next door cannot see: an
 * extent names each tail's LAST segment and its size ({@link chainExtent}, "what it
 * does not see"), so removing a sealed earlier segment leaves the extent identical.
 * A retained replay measured only against the extent would go on serving events the
 * chain no longer holds.
 */
export interface TailReach {
  /**
   * The last `seq` read from this tail, or -1 for a tail that held nothing.
   *
   * It says what the arrivals must CONTINUE from, and nothing else. It used to say
   * where to resume READING from as well, and that is the premise {@link boundary}
   * falsified: see there.
   */
  readonly lastSeq: number;
  /**
   * The hash of the last entry read from this tail, or null for a tail that held none:
   * what the FIRST arrival has to name as its `prev`.
   *
   * IT IS HERE BECAUSE THE SEQ IS ONLY TWO THIRDS OF THE RULE. A tail stops chaining in
   * three ways ({@link linkBreakAt}) (an entry stored under a tail it does not name, a
   * seq that does not follow, and a `prev` that names something other than the entry
   * before it) and the frontier used to carry what answers the first two. Measured, that
   * left the third invisible to every incremental reading: over a tail whose entry at the
   * boundary had been replaced by a DIFFERENT entry of the same seq, a fresh
   * {@link chainReplay} reported a `prev-hash break` and {@link chainArrivals} called the
   * same bytes a sound suffix. It is the same shape of hole {@link TailReach.boundary}
   * closed for duplicates, one rule over.
   *
   * The reading has it: the hash is on the entry it just parsed, so carrying it costs
   * nothing and asking for it later would cost a second reading of the tail.
   */
  readonly lastHash: string | null;
  /**
   * WHERE the reading stopped, in bytes: the position the arrivals are read from.
   * Undefined for a tail that held nothing, which has no position to name.
   *
   * THE SEQ USED TO BE BOTH, AND THAT WAS THE HOLE. Resuming from `lastSeq` means
   * asking the tail for the entries above it, and the walk that answers stops at the
   * first entry CARRYING that seq, which a duplicate of the boundary entry satisfies.
   * Measured, over a tail whose last entry was appended a second time, a full replay
   * reported ONE break while a resumed reading reported that nothing had arrived at
   * all. Resumed from the BYTE, that duplicate is past the boundary, so it is an
   * arrival like any other and {@link chainArrivals} rules on it with the same rule it
   * applies to everything else. `order.test.ts` ("a resumed reading sees a duplicate of
   * the boundary entry") holds it.
   */
  readonly boundary: TailBoundary | undefined;
  /** The tail's segment files, in order, as they stood when it was read. */
  readonly segments: readonly string[];
  /**
   * The greatest `at` among the events read from THIS tail, or the empty string for
   * a tail that held none. Per tail and not for the order as a whole, because the
   * only comparison the merge makes is between heads of DIFFERENT tails: see the
   * suffix test in {@link chainArrivals}.
   */
  readonly latestAt: string;
  /** How far the tail's checkpoints were folded: absent for a reading that folded none. */
  readonly signed?: TailSignedReach;
}

/**
 * How far a replay reached: the mark a later reading of the same chain measures
 * itself against.
 *
 * It is what makes "what arrived since?" answerable without reading the chain
 * again: the proven position of every tail at the moment the order was built, plus
 * the two facts {@link chainArrivals} needs to decide whether the new events form a
 * SUFFIX of that order rather than an interleave into the middle of it.
 */
export interface ChainFrontier {
  /** How far each tail was read, by tail id. */
  readonly tails: ReadonlyMap<string, TailReach>;
  /** How many events the order held: the base position of the next arrival. */
  readonly events: number;
  /**
   * The entry hashes the covered events cite and the chain did not hold: citations the
   * order ignored. An arrival that IS one of them would have held its citing event back,
   * so it cannot be a suffix: see {@link chainArrivals}.
   */
  readonly unresolved: readonly string[];
}

/** One reading of a chain: the order it produced, and how far it reached. */
export interface ChainReplay {
  readonly events: CatalogEvent[];
  readonly frontier: ChainFrontier;
  /**
   * The tails that do not chain: one entry per tail, the FIRST break in each.
   *
   * It rides on the replay rather than being asked for separately because that is
   * what keeps it from being optional in practice: the events and the fact that the
   * events do not add up come off the same reading, so a caller cannot take one and
   * forget the other existed. Empty on an intact record, which is every record the
   * product writes on its own.
   */
  readonly linkBreaks: readonly LinkBreak[];
  /**
   * The lines of a kind this binary does not know, which the merge left out of `events` (ADR-113):
   * what a newer mnema wrote and this reading read past. It rides on the replay for the reason the
   * breaks do, and is empty for every record this version wrote.
   */
  readonly unread: readonly UnreadLine[];
  /**
   * The lines whose hash does not hold, ALL of them in every tail: read, left out of `events`,
   * and said by every surface (the entry's own text never rides with the fact). It rides on the
   * replay as the breaks do, and is empty for every record the product wrote on its own.
   */
  readonly retained: readonly RetainedEntry[];
  /**
   * The parts of the record the reading did not read: a line of a segment that does not parse and a
   * symbolic link, which the reading left out and went on past. They ride on the replay as the
   * retained lines do, and are empty for every record this version wrote and nothing damaged.
   */
  readonly refused: readonly RefusedPart[];
  /**
   * The records the directory holds tails of, where it holds two or more (`tailsReadAt`): then
   * nothing was read. Empty for a directory of one record. It rides on the replay so a surface
   * that says why nothing governs asks no second reading of the tails.
   */
  readonly several: readonly RecordGroup[];
  /**
   * What the tails' checkpoints proved (ADR-557 to ADR-562): the runs withheld (Fact A) and the
   * runs served and not signed (Fact B). `events` holds the PROVEN events only (ADR-561): an event
   * no holding checkpoint and no note of this machine covers is never folded into a projection.
   */
  readonly signed: readonly SignedFact[];
}

/**
 * Reads the record's tails, merges them, AND reports how far the reading reached.
 *
 * The frontier is a by-product rather than a second pass: each tail's last `seq`
 * is in hand the moment its entries are parsed, so learning it costs nothing.
 * {@link orderedEvents} is this function with the frontier dropped: one merge,
 * one reading, one order, so a caller that wants both cannot get two.
 */
export function chainReplay(
  layout: ChainLayout,
  upcasters: UpcasterRegistry,
  serveAround = false,
  proof?: ReadProof,
): ChainReplay {
  const linked = refusedParts();
  const reading = tailsReadAt(layout, serveAround ? linked.collect : undefined);
  // The key folder the checkpoints are verified under: one the disk will not open is a part of the
  // record not read, named as a segment the disk refuses is, before what it leaves unproven.
  if (serveAround) keysTheDiskRefuses(layout, linked.collect);
  const streams = streamsOf(layout, upcasters, 0, reading.read, serveAround ? linked : undefined, {
    keys: committedKeys(layout),
    proof: proof ?? proofOf(layout),
  });
  const tails = new Map<string, TailReach>();
  for (const stream of streams) {
    // One `readdir` per tail beside the reading of it. A replay parses every line of
    // every segment, so listing their names again is not a cost worth avoiding, and
    // the list is what a later reading needs to know the chain did not shrink.
    tails.set(stream.tail, {
      lastSeq: stream.lastSeq,
      lastHash: stream.lastHash,
      boundary: stream.boundary,
      segments: orderedSegments(layout, stream.tail, serveAround ? linked.collect : undefined),
      latestAt: latestAt(stream.events),
      ...(stream.signed !== undefined ? { signed: stream.signed.reach } : {}),
    });
  }
  const { events, unresolved } = mergeStreams(streams);
  const linkBreaks = streams
    .map((stream) => stream.linkBreak)
    .filter((broken): broken is LinkBreak => broken !== undefined);
  return {
    events,
    frontier: { tails, events: events.length, unresolved },
    linkBreaks,
    unread: streams.flatMap((stream) => stream.unread),
    retained: streams.flatMap((stream) => stream.retained),
    refused: linked.parts,
    several: reading.several,
    signed: streams.flatMap((stream) => stream.signed?.facts ?? []),
  };
}

/** What a chain holds beyond a frontier, when that can be said as a suffix. */
export type ChainArrivals =
  | {
      /** The order the frontier covered is a PREFIX of the order now: these follow it. */
      readonly suffix: true;
      /** The arrivals, in the same merge the whole order would have put them in. */
      readonly events: readonly CatalogEvent[];
      /** How far the chain reaches now: the frontier a caller records after using these. */
      readonly frontier: ChainFrontier;
      /** The arrivals of a kind this binary does not know, which `events` leaves out. */
      readonly unread: readonly UnreadLine[];
      /** As {@link ChainReplay.several}: empty, since a directory of two records reads no tail. */
      readonly several: readonly RecordGroup[];
    }
  | {
      /** No suffix describes the difference: the whole order has to be read again. */
      readonly suffix: false;
      /**
       * Which of the three ways that happens, for the caller that reports it. The record
       * itself is intact in all three: a tail was removed, cut, or carries facts older
       * than what is already covered.
       */
      readonly why:
        | 'A_TAIL_IS_GONE'
        | 'A_TAIL_WAS_CUT'
        | 'AN_ARRIVAL_IS_NOT_LATER'
        | 'AN_ARRIVAL_IS_NOT_SIGNED';
    }
  | {
      /**
       * The arrivals do not run on from the frontier: the record's own proof is broken,
       * and this is the one refusal that is about the RECORD rather than about the shape
       * of the difference.
       */
      readonly suffix: false;
      readonly why: 'AN_ARRIVAL_DOES_NOT_CHAIN';
      /**
       * WHERE it stops chaining, in the verdict's own wording: an arm of its own so that
       * a caller holding one of the other three cannot reach for a break that is not
       * there, and one holding this cannot answer without it.
       *
       * It is the first break among the ARRIVALS of the first tail that has one, and
       * {@link broken} is every tail's. It is narrower than {@link ChainReplay.linkBreaks}
       * in one way a reader has to know: a break below the frontier, bytes a previous
       * reading already accepted, is outside it.
       */
      readonly broke: LinkBreak;
      /**
       * The first break among the arrivals of EVERY tail that has one, in tail order, one
       * per tail: what a full reading reports of the tails it reads, and what
       * {@link broke} used to be the only half of. THIS ARM STOPPED AT THE FIRST BROKEN TAIL,
       * so a tree whose two tails broke after the last reading was told of one of them by
       * a read that could have named both. The rest of the tails are read only once one has
       * broken, so a chain that chains pays nothing for it.
       */
      readonly broken: readonly LinkBreak[];
      /** The arrivals whose hash does not hold, in every tail: see {@link ChainArrivals}'s next arm. */
      readonly retained: readonly RetainedEntry[];
      /** The parts the arrivals hold that were not read: see {@link ChainArrivals}'s next arm. */
      readonly refused: readonly RefusedPart[];
    }
  | {
      /**
       * An arrival is an entry whose hash does not hold, and the arrivals chain: the line is
       * left out of what is served and named, so no suffix describes the difference. THE FACT
       * HAS ITS OWN ARM for the reason the break has: the reading that found it is the one
       * holding the line, and a caller asked what the chain says NOW (`linkBreaksAsOfNow`) is
       * answered from it, not from a replay. A whole reading says the same of the same bytes.
       *
       * THE SAME ARM SAYS A PART THE ARRIVALS HOLD AND THE READING DID NOT READ: a line that does not
       * parse, a symbolic link. It is left out and named as an altered entry is, for the same reason.
       */
      readonly suffix: false;
      readonly why: 'AN_ARRIVAL_IS_RETAINED';
      readonly retained: readonly RetainedEntry[];
      readonly refused: readonly RefusedPart[];
    };

/**
 * What the chain holds beyond `frontier`, as a SUFFIX of the order that frontier
 * covered, or a refusal saying no suffix describes it.
 *
 * It costs the arrivals and not the chain: per tail it reads only the entries past the
 * BYTE the frontier stopped at ({@link readTailSince}, whose cost is the entries
 * returned and not the file they sit in). A chain that did not move is one entry per
 * tail: the newest, which the backward walk reads before it reaches the boundary.
 *
 * WHY A SUFFIX AND NOT JUST "THE NEW EVENTS". The merge places an event by its `at`
 * against the heads of every other tail, so a tail that arrives holding an OLDER
 * event lands in the middle of the order and every position after it shifts. A
 * caller that has already materialized the covered order by position (the reference
 * index is one row per position) would then be holding rows that name the wrong
 * events.
 *
 * SO THE TEST IS THE MERGE'S OWN COMPARISON, and it is per TAIL rather than over the
 * order as a whole. Within one tail nothing has to be tested at all: `seq` is the
 * order and an arrival's `seq` is above everything covered, so it follows by proof
 * whatever its `at` says, which is the same reason the merge never compares two
 * events of one tail. What has to be tested is an arrival against the covered events
 * of the OTHER tails, and there the comparison is `(at, tail)`, exactly as the merge
 * ({@link causalOrder}) makes it between heads. A citation can only hold an arrival back
 * further, never bring it forward, so it adds two cases and changes none: an arrival that a
 * covered event cites (its citation was ignored, and would not be now), and an arrival
 * citing an entry the frontier cannot place.
 *
 * That distinction is not a refinement, it is what makes the fast path reachable.
 * The first version of this test compared every arrival against the greatest `at` in
 * the whole order and refused a tie, and a tie is the COMMON case: `at` has
 * millisecond resolution, and a session appending twice inside one millisecond ties
 * with itself. Measured, that refused the suffix on a run of appends to a single tail
 * and replayed the chain every time, which is the whole cost this was built to avoid.
 * A one-tail chain (one machine, one key, which is most of them) now always has a
 * suffix.
 *
 * Three ways the answer is no, and each is a real thing that happens rather than a
 * defensive branch:
 *   - `A_TAIL_IS_GONE`: a tail the replay covered is not there any more. The chain
 *     did not grow, it changed.
 *   - `A_TAIL_WAS_CUT`: the tail lost a segment it had, or no longer holds the entry
 *     the replay ended on. A cut is what `mnema tail prune` authorizes and what a
 *     person then carries out, and it removes SEALED segments, so it is caught by
 *     the segment list rather than by the resume point, which sits above it and would
 *     see nothing.
 *   - `AN_ARRIVAL_IS_NOT_LATER`: an arrival does not follow the covered events of the
 *     other tails under the merge's own comparison. Ordinary in a pulled clone, whose
 *     tail carries a colleague's older facts, and ordinary from a clock that stepped
 *     back.
 *   - `AN_ARRIVAL_DOES_NOT_CHAIN`: the arrivals do not run contiguously on from where
 *     the frontier stopped. This one is NOT ordinary: it is a break in the record's own
 *     proof, and it is the arm that CARRIES the break, because the reading that found it
 *     is the one holding the entry. What it names is narrower than a full reading's
 *     verdict and the arm says how ({@link ChainArrivals}); a caller that wants every
 *     broken tail reads the whole chain again.
 *
 *     IT USED TO MISS TWO SHAPES OF BREAK, one found per delivery, and neither was this
 *     rule being lenient about what it was handed.
 *
 *     The first was WHERE THE ARRIVALS WERE READ FROM. A tail resumed from its last
 *     `seq` yields nothing when its boundary entry has been appended a second time:
 *     the duplicate carries that seq, so the walk stops on it and reports an empty
 *     suffix. Resumed from the boundary BYTE the duplicate is an arrival, this rule
 *     sees it, and the full reading follows. `order.test.ts` holds it.
 *
 *     The second was THE RULE HERE BEING TWO THIRDS OF THE VERDICT'S. This asked a seq
 *     test written in this file rather than {@link firstLinkBreakFrom}, because the
 *     frontier carried no hash for the `prev` half to be asked against. Measured, over a
 *     tail whose boundary entry had been replaced by a DIFFERENT entry of the same seq, a
 *     fresh {@link chainReplay} reported `prev-hash break` and this called the same bytes
 *     a sound suffix, so a live session refreshed straight past a break that the next
 *     process to open the record was told about. The frontier carries the hash now
 *     ({@link TailReach.lastHash}) and the question is the verifier's own function, asked
 *     of a run that starts at the boundary instead of at a tail's birth.
 *
 * The caller's move in the first three is the same and is not this function's to make:
 * read the whole chain again.
 */
export function chainArrivals(
  layout: ChainLayout,
  upcasters: UpcasterRegistry,
  frontier: ChainFrontier,
): ChainArrivals {
  // The tails of the record, not every tail of the directory: none of a directory of two records
  // (`tailsReadAt`), so a frontier that held tails reads them as gone and the replay is whole.
  const linked = refusedParts();
  const reading = tailsReadAt(layout, linked.collect);
  const tails = reading.read;
  const present = new Set(tails);
  const unresolved = new Set(frontier.unresolved);
  for (const tail of frontier.tails.keys()) {
    if (!present.has(tail)) return { suffix: false, why: 'A_TAIL_IS_GONE' };
  }

  const streams: TailStream[] = [];
  const reached = new Map(frontier.tails);
  const keys = committedKeys(layout);
  let notSigned = false;
  // The breaks the arrivals carry, and the first reason no suffix describes them: a break is
  // what every tail is read to find, so reading goes on past it, and a refusal of another kind
  // is reported only when no tail broke.
  const broken: LinkBreak[] = [];
  const retained: RetainedEntry[] = [];
  const refused: RefusedPart[] = [];
  let refusal: ChainArrivals | undefined;
  for (const tail of tails) {
    const covered = frontier.tails.get(tail);
    const segments = orderedSegments(layout, tail, linked.collect);
    if (covered !== undefined && !startsWith(segments, covered.segments)) {
      refusal ??= { suffix: false, why: 'A_TAIL_WAS_CUT' };
      continue;
    }
    // A tail nothing was read from (one that appeared, or one that was empty when the
    // frontier was taken) contributes all of itself: there is no position to resume
    // from, so this asks for the whole tail plainly.
    const own = refusedParts();
    const since =
      covered === undefined || covered.boundary === undefined
        ? wholeTail(layout, tail, upcasters, own)
        : readTailSince(layout, tail, upcasters, covered.boundary, covered.lastHash, own.collect);
    if (since === undefined) {
      refusal ??= { suffix: false, why: 'A_TAIL_WAS_CUT' };
      continue;
    }
    // EVERY arrival, the retained included: the chain is measured over the lines as stored,
    // against the hash each stores, so an altered line is one fact and not one and a break.
    const entries = since.arrivals;
    retained.push(...since.retained);
    refused.push(...own.parts);
    // A retained arrival is returned below as its own refusal before any merge, so what reaches the
    // order is already what holds; `served` is that, said once.
    const served = since.served;
    // The arrivals have to run on from where the frontier stopped, by the verifier's own
    // rule and in the verifier's own function ({@link firstLinkBreakFrom}): the same one
    // a whole-tail read asks, given a starting seq and a starting hash instead of a
    // tail's birth. It is asked over the ENTRIES PAST THE BOUNDARY BYTE, which is what
    // lets it see a duplicate of the boundary entry: read from the seq instead, that
    // duplicate would satisfy the boundary and never be an arrival at all (see
    // {@link TailReach.boundary}). What is still outside this question is a break BELOW
    // the boundary, bytes a previous reading already accepted, and that is the full
    // reading's to find, not this one's.
    // A seq below the boundary is asked about only when an arrival takes one again, which is
    // the question that tells a fork from a gap: the whole tail is read then, and only then, so
    // the arrivals name it in the words a full reading of the same bytes does.
    let whole: readonly ChainEntry[] | undefined;
    const broke = firstLinkBreakFrom(
      tail,
      entries,
      (covered?.lastSeq ?? -1) + 1,
      covered?.lastHash ?? null,
      (seq) => {
        whole ??= readTail(layout, tail, upcasters, undefined, undefined, 'every line').entries;
        const held = whole[seq];
        return held?.link.seq === seq ? held.link : undefined;
      },
    );
    if (broke !== undefined) {
      broken.push(broke);
      continue;
    }
    const last = entries[entries.length - 1];
    const lastSeq = last === undefined ? (covered?.lastSeq ?? -1) : last.link.seq;
    const lastHash = last === undefined ? (covered?.lastHash ?? null) : last.link.hash;
    // ONLY WHAT A CHECKPOINT PROVES ARRIVES (ADR-561): the new lines of `checkpoints.jsonl`, each
    // with its own signature, must hold, chained on from where the last reading stopped, and cover
    // every arrival. Anything else (a line that fails, an arrival no line covers yet, a tail whose
    // last reading left something unproven) is not a suffix: the record is read whole again, and
    // that reading says what it found.
    const signed = arrivalsSigned(layout, tail, covered, served, entries, keys);
    if (signed === undefined) {
      // Said only when no tail gives a reason about the order: the reason does not depend on
      // which tail the listing happened to name first.
      notSigned = true;
      continue;
    }
    const fresh = served.map((entry) => entry.event);
    reached.set(tail, {
      lastSeq,
      lastHash,
      boundary: since.boundary,
      segments,
      latestAt: greater(covered?.latestAt ?? '', latestAt(fresh)),
      signed,
    });
    if (fresh.length === 0) continue;
    // A citation the covered order ignored, now satisfied: the event citing it would have
    // waited for this one, so what was covered is not a prefix of the order any more.
    if (served.some((entry) => unresolved.has(entry.link.hash))) {
      refusal ??= { suffix: false, why: 'AN_ARRIVAL_IS_NOT_LATER' };
    }
    // The arrivals of this tail must follow the covered events of every OTHER tail,
    // under the comparison the merge makes between heads. Nothing is asked about this
    // tail's own covered events: `seq` already settles those.
    for (const event of fresh) {
      for (const [other, reach] of frontier.tails) {
        if (other === tail || reach.latestAt === '') continue;
        if (reach.latestAt > event.at) {
          refusal ??= { suffix: false, why: 'AN_ARRIVAL_IS_NOT_LATER' };
        }
        // The tie the merge breaks on the tail id: an arrival that ties with a covered
        // event of a tail that sorts LATER would be placed before it.
        if (reach.latestAt === event.at && other > tail) {
          refusal ??= { suffix: false, why: 'AN_ARRIVAL_IS_NOT_LATER' };
        }
      }
    }
    streams.push({
      tree: 0,
      events: fresh,
      hashes: served.map((entry) => entry.link.hash),
      tail,
      lastSeq,
      lastHash,
      unread: unreadLinesOf(tail, served),
      retained: [],
    });
  }

  // What an arrival cites has to be somewhere the merge of the arrivals can place it: among
  // the arrivals, or the last covered entry of a tail, which every arrival follows. Anything
  // else is an entry the frontier cannot place (covered further down, or not held at all)
  // and telling those apart would take the reading this exists to avoid, so the order is
  // read again instead.
  if (refusal === undefined && !notSigned && broken.length === 0 && citesBeyond(streams, reached)) {
    refusal = { suffix: false, why: 'AN_ARRIVAL_IS_NOT_LATER' };
  }

  const [firstBreak] = broken;
  if (firstBreak !== undefined) {
    return {
      suffix: false,
      why: 'AN_ARRIVAL_DOES_NOT_CHAIN',
      broke: firstBreak,
      broken,
      retained,
      refused,
    };
  }
  if (retained.length > 0 || refused.length > 0) {
    return { suffix: false, why: 'AN_ARRIVAL_IS_RETAINED', retained, refused };
  }
  if (refusal !== undefined) return refusal;
  if (notSigned) return { suffix: false, why: 'AN_ARRIVAL_IS_NOT_SIGNED' };

  // The SAME merge the whole order goes through, over the arrivals alone. It is the
  // same function and the same keys, which is what makes the result the tail of the
  // order rather than a second convention for interleaving. The moves are NOT judged here:
  // the arrivals alone are not the history a move is judged against, and the advance judges
  // each against the state the cache holds (`advance.ts`).
  const { events } = mergeStreams(streams, false);
  return {
    suffix: true,
    events,
    frontier: {
      tails: reached,
      events: frontier.events + events.length,
      unresolved: frontier.unresolved,
    },
    unread: streams.flatMap((stream) => stream.unread),
    several: reading.several,
  };
}

/**
 * How far a tail's checkpoints reach once the new lines are folded over the arrivals, or undefined
 * when the arrivals are not a proven suffix: the tail's last reading left something unproven, a
 * new line does not hold (each signature checked), or an arrival is covered by no new line.
 */
function arrivalsSigned(
  layout: ChainLayout,
  tail: string,
  covered: TailReach | undefined,
  served: readonly ChainEntry[],
  arrivals: readonly ChainEntry[],
  keys: CommittedKeys,
): TailSignedReach | undefined {
  // A tail the frontier did not hold starts from nothing: no line folded, nothing covered.
  const before: TailSignedReach | undefined =
    covered === undefined
      ? { clean: true, mark: { bytes: 0, lastLineAt: 0, mtimeNs: '' }, prev: null, covered: -1 }
      : covered.signed;
  if (before === undefined || !before.clean) return undefined;
  if (served.length !== arrivals.length) return undefined;
  const since = readTailCheckpointsSince(layout, tail, before.mark, before.prev, checkpointHash);
  if (since === undefined) return undefined;
  let prev = before.prev;
  let at = before.covered;
  for (const checkpoint of since.checkpoints) {
    const range = arrivals.filter(
      (entry) => entry.link.seq >= checkpoint.fromSeq && entry.link.seq <= checkpoint.toSeq,
    );
    const ruling = ruleOnCheckpoint({
      tail,
      checkpoint,
      prev,
      from: at + 1,
      range,
      keys,
      signature: 'checked',
    });
    if (!ruling.holds || !checkpointBelongsToItsTail(tail, checkpoint)) return undefined;
    prev = ruling.hash;
    at = checkpoint.toSeq;
  }
  const lastSeq = arrivals[arrivals.length - 1]?.link.seq ?? covered?.lastSeq ?? -1;
  if (at !== lastSeq) return undefined;
  return { clean: true, mark: since.mark, prev, covered: at };
}

/**
 * Whether an arrival cites an entry the arrivals' own merge cannot place: one that is neither
 * an arrival nor the last covered entry of some tail.
 */
function citesBeyond(
  streams: readonly TailStream[],
  reached: ReadonlyMap<string, TailReach>,
): boolean {
  const placed = new Set<string>();
  for (const stream of streams) for (const hash of stream.hashes) placed.add(hash);
  for (const reach of reached.values()) if (reach.lastHash !== null) placed.add(reach.lastHash);
  return streams.some((stream) =>
    stream.events.some((event) => (event.after ?? []).some((hash) => !placed.has(hash))),
  );
}

/** The greater of two instants: the per-tail high-water mark, carried forward. */
function greater(a: string, b: string): string {
  return a > b ? a : b;
}

/** Whether `list` begins with `prefix`: the segment test, and nothing more. */
function startsWith(list: readonly string[], prefix: readonly string[]): boolean {
  if (prefix.length > list.length) return false;
  return prefix.every((name, index) => list[index] === name);
}

/**
 * A tail read WHOLE, in the shape a resumed reading returns: for the tail that has no
 * boundary to resume from because the frontier found it empty, or did not find it.
 *
 * THIS REPLACED `aboveBoundary`, which took the tip a `seq`-anchored read returned and
 * sliced off the entry it stopped on, trusting that entry to be the one the frontier
 * had covered. That trust is what a duplicate of the boundary entry broke: the walk
 * stopped on the COPY, the slice removed it, and the real arrival, the copy itself,
 * was gone from the result. Anchored on a byte there is nothing to slice, so nothing to
 * trust: see {@link TailReach.boundary}.
 */
function wholeTail(
  layout: ChainLayout,
  tail: string,
  upcasters: UpcasterRegistry,
  own: { readonly collect: RefusedLine; readonly parts: readonly RefusedPart[] },
): ReadSoFar {
  const read = readTail(layout, tail, upcasters, own.collect, undefined, 'what holds', own.collect);
  // A tail that holds no entry has no position, so the frontier records `undefined`
  // for it and the reading after this one reads it whole again, which costs nothing,
  // because there is nothing there.
  return {
    arrivals: read.every,
    served: read.entries,
    retained: read.retained,
    boundary: read.boundary,
  };
}

/** The greatest `at` in an order, or the empty string when it holds nothing. */
function latestAt(events: readonly (CatalogEvent | UnreadEvent)[]): string {
  let latest = '';
  for (const event of events) {
    if (event.at > latest) latest = event.at;
  }
  return latest;
}

/** Several chains ordered two ways, from ONE reading of their tails. */
export interface RecordOrder {
  /**
   * Each chain on its own, in the order {@link orderedEvents} gives it: the view
   * of a question whose answer is a property of ONE chain rather than of the
   * record as a whole. One entry per layout, in the caller's order; a chain with
   * no tails contributes an empty entry rather than dropping out, so the entries
   * still line up with the layouts.
   */
  readonly chains: readonly (readonly CatalogEvent[])[];
  /**
   * ALL of the chains' tails in one total, deterministic order: the union a person
   * sees across their trees (project-public, project-private, global). Every tail
   * from every chain joins ONE k-way merge, so there is no cross-tree precedence:
   * an event's place is decided by its own `at` against every other head, the same
   * rule that orders tails within a chain. Two trees never collide on the same
   * event id (ids are minted v7), so this is a plain interleave with no
   * de-duplication.
   */
  readonly across: readonly CatalogEvent[];
  /** The lines of a kind this binary does not know, which both views leave out, in every chain. */
  readonly unread: readonly UnreadLine[];
}

/**
 * Reads the tails of `layouts` ONCE and orders them both ways: each chain by
 * itself, and all of them together.
 *
 * BOTH, from one reading, because reading is the expensive half and the callers that
 * want the union want the chains too. A question about the record as a whole folds
 * `across`; a question whose answer is a property of one chain (the `ADR-<n>` label,
 * numbered from the writer's view of a single chain) folds `chains`. The second order
 * is a walk over streams already in memory, so it costs a walk rather than a second
 * parse of every segment.
 *
 * It replaced a narrower `orderedEventsAcross` that gave the union alone. When the
 * audit came to need both views, that function's every production caller became a
 * caller of this one, and a public value with no caller is the defect the workspace
 * guards against, so the union kept its behaviour and lost its own name. What guards
 * that behaviour now is `topology/compose.test.ts`, which asserts the interleave, the
 * determinism and the absence of id collisions over three trees.
 *
 * Each layout is tagged with an index so tie-breaking stays deterministic even when
 * two trees share a tail id (one key installed into each). Absent or empty chains
 * contribute no streams (a caller can pass every candidate tree and let the ones
 * that do not exist drop out), but they still hold their place in `chains`.
 *
 * A chain's own order is the one {@link orderedEvents} gives it, and that is asserted
 * rather than assumed (`order.test.ts`, "orders each chain exactly as `orderedEvents`
 * does"). The tree's position breaks a tie here before the tail id does, which cannot
 * change a within-chain order: every stream of one chain has the same position, so they
 * compare exactly as their tail ids do. And a citation resolves inside its own chain, so
 * it reorders a chain against itself and nothing else.
 */
export function orderedEventsOfRecord(
  layouts: readonly ChainLayout[],
  upcasters: UpcasterRegistry,
): RecordOrder {
  // Each chain folded as {@link chainReplay} folds it: only what its checkpoints prove is ordered.
  const perChain = layouts.map((layout, index) =>
    streamsOf(layout, upcasters, index, tailsReadAt(layout).read, undefined, {
      keys: committedKeys(layout),
      proof: proofOf(layout),
    }),
  );
  // A move is judged inside its own chain, as a citation resolves there: what each chain leaves
  // out is left out of the union too, so the two views never disagree about one move.
  const chains = perChain.map((streams) => mergeStreams(streams));
  const left = new Set(chains.flatMap((chain) => [...chain.left]));
  return {
    chains: chains.map((chain) => chain.events),
    across: mergeStreams(perChain.flat(), false).events.filter((event) => !left.has(event)),
    unread: perChain.flatMap((streams) => streams.flatMap((stream) => stream.unread)),
  };
}

/**
 * Builds the per-tail streams of one chain. `tree` is the chain's position in the list a
 * caller gave, which breaks a tie between two trees before the tail id does, so streams
 * from different trees never tie on their key even when they share a tail id. A single
 * chain is tree 0, which leaves the single-chain order the tail id's alone.
 */
function streamsOf(
  layout: ChainLayout,
  upcasters: UpcasterRegistry,
  tree: number,
  read: readonly string[],
  linked?: { readonly collect: RefusedLine },
  signatures?: { readonly keys: CommittedKeys; readonly proof?: ReadProof },
): TailStream[] {
  return read.map((tail) => {
    // What signs the tail is read BEFORE the tail ({@link signingOf}).
    const signing =
      signatures === undefined
        ? undefined
        : signingOf(layout, tail, signatures.keys, linked?.collect, signatures.proof);
    // `readTail` rather than `readTailEntries`: the same bytes, plus what the read
    // had to notice about them. A reading that took only the entries is how a chain
    // the verifier refuses was served by every read with no word about it.
    const read = readTail(
      layout,
      tail,
      upcasters,
      linked?.collect,
      undefined,
      'what holds',
      linked?.collect,
    );
    const signed =
      signatures === undefined || signing === undefined
        ? undefined
        : signedOf(tail, read, signatures.keys, signing);
    // Only what is proven reaches a projection (ADR-561): the rest is said, never folded.
    const entries =
      signed === undefined
        ? read.entries
        : read.entries.filter((entry) => signed.proven.has(entry.link.hash));
    return {
      tree,
      events: entries.map((entry) => entry.event),
      hashes: entries.map((entry) => entry.link.hash),
      tail,
      // Where the tail ENDS is the last line it holds, a retained one included: what the next
      // line has to name, and where a resumed reading picks up.
      lastSeq: read.last?.seq ?? -1,
      lastHash: read.last?.hash ?? null,
      ...(read.boundary !== undefined ? { boundary: read.boundary } : {}),
      ...(read.linkBreak !== undefined ? { linkBreak: read.linkBreak } : {}),
      unread: unreadLinesOf(tail, entries),
      retained: read.retained,
      ...(signed !== undefined ? { signed: { facts: signed.facts, reach: signed.reach } } : {}),
    };
  });
}

/**
 * What signs one tail, read BEFORE the tail itself, in the order the writer writes it backwards:
 * the signed note (kept last, on the way out of an act), then `checkpoints.jsonl` (appended after
 * the events it covers). So every event a checkpoint or the note names is already on the disk
 * when the tail is read, and a write landing between the two readings only adds events the
 * checkpoints read do not cover yet: one write's window. Read the other way round, a checkpoint
 * appended between the reading of the tail and the reading of its checkpoints covered a seq the
 * reading did not hold, which is a signed event that is gone, and a write was refused over it.
 */
interface Signing {
  readonly note: ReturnType<typeof noteOf>;
  readonly checkpoints: ReturnType<typeof readTailCheckpointsMarked>['checkpoints'];
  readonly mark: CheckpointsMark;
}

function signingOf(
  layout: ChainLayout,
  tail: string,
  keys: CommittedKeys,
  refused: RefusedLine | undefined,
  proof: ReadProof | undefined,
): Signing {
  const note = noteOf(layout, tail, keys, proof);
  const { checkpoints, mark } = readTailCheckpointsMarked(layout, tail, refused);
  return { note, checkpoints, mark };
}

/**
 * Folds one tail's checkpoints over everything the reading of it held (`foldCheckpoints`,
 * `@mnema/chain`): which entries are proven, the facts said of the rest, and where the folding of
 * `checkpoints.jsonl` stopped.
 */
function signedOf(
  tail: string,
  read: ReturnType<typeof readTail>,
  keys: CommittedKeys,
  { note, checkpoints, mark }: Signing,
): {
  readonly proven: ReadonlySet<string>;
  readonly facts: readonly SignedFact[];
  readonly reach: TailSignedReach;
} {
  const standing = new Set<number>(read.retained.map((one) => one.seq));
  if (read.linkBreak !== undefined) standing.add(read.linkBreak.seq);
  const signed = foldCheckpoints({
    tail,
    entries: read.every,
    checkpoints,
    keys,
    standing,
    window: DEFAULT_MAX_UNSIGNED_EVENTS,
    ...(note !== undefined ? { note } : {}),
  });
  const facts: SignedFact[] = signed.withheld.map((withheld) => ({ tail, withheld }));
  for (const run of signed.proven) {
    if (run.by === 'note') {
      facts.push({
        tail,
        unsigned: {
          fromSeq: run.fromSeq,
          toSeq: run.toSeq,
          count: run.toSeq - run.fromSeq + 1,
          byNote: true,
        },
      });
    }
  }
  if (signed.unproven !== undefined) {
    facts.push({ tail, unsigned: { ...signed.unproven, byNote: false } });
  }
  const last = checkpoints[checkpoints.length - 1];
  const lastSeq = read.last?.seq ?? -1;
  return {
    proven: signed.provenHashes,
    facts,
    reach: {
      clean: facts.length === 0 && signed.failedLines === 0 && signed.signedTo === lastSeq,
      mark,
      prev: last === undefined ? null : checkpointHash(last),
      covered: last === undefined ? -1 : last.toSeq,
    },
  };
}

/**
 * Where a reading of `layout` finds this machine's signed notes when its caller named no place: the
 * place a public tree inside a repository shares with every worktree (`notesRootOf`), and the
 * tree's own `locks/` after it ({@link noteOf}).
 */
function proofOf(layout: ChainLayout): ReadProof {
  const notesRoot = notesRootOf(layout.root);
  return notesRoot === undefined ? {} : { notesRoot };
}

/** This machine's signed note of `tail`, verified with the tail's committed key, or undefined. */
function noteOf(
  layout: ChainLayout,
  tail: string,
  keys: CommittedKeys,
  proof: ReadProof | undefined,
) {
  const owner = tailFingerprint(tail);
  const key = keys(owner);
  if (key === null || key.fingerprint() !== owner) return undefined;
  // The shared place first (a public tree inside a repository), then the tree's own `locks/`.
  return (
    (proof?.notesRoot === undefined
      ? undefined
      : readWrittenHead({ root: proof.notesRoot }, tail, key.key)) ??
    readWrittenHead(layout, tail, key.key)
  );
}

/**
 * The events about a few subjects, off the chain itself (`subjectEvents`), keeping only the ones a
 * signature proves (ADR-561): what a gate judges a move on, so that an event the projection never
 * folds never decides whether a move is legal either. The bytes as written would let one write's
 * window (an event no checkpoint covers yet, a forged one included) refuse an accept or let a
 * supersede through.
 *
 * WHAT IS ASKED, AND WHAT IT COSTS. Only the tails that hold a line about a subject are asked, and
 * each is asked first the cheap question: does its last checkpoint line carry a signature that
 * holds under the tail's own committed key, and does it cover every line found there? Then every
 * line found is proven or the tail stands as Fact A (a range that does not fold to its root, a line
 * that does not belong to the run the checkpoints cover): a fact every write is refused over
 * before it reaches a gate, so what a gate would make of such a line is never appended. Any other
 * tail (a line found above the last checkpoint, no checkpoint, a last line that does not verify)
 * is folded in full as the projection folds it ({@link signedOf}, this machine's signed note
 * included), once per tail, and only the events it proves are kept. That is a reading of the
 * tail, paid only while a write's window holds a line about the subject.
 */
export function provenSubjectEvents(
  layout: ChainLayout,
  upcasters: UpcasterRegistry,
  ids: readonly string[],
  proof?: ReadProof,
): Map<string, CatalogEvent[]> {
  return subjectEvents(layout, upcasters, ids, provenOnTails(layout, upcasters, proof));
}

/** Which lines of a tail a signature proves, as {@link provenSubjectEvents} asks it. */
function provenOnTails(
  layout: ChainLayout,
  upcasters: UpcasterRegistry,
  proof: ReadProof | undefined,
): ProvenOnTail {
  const keys = committedKeys(layout);
  const folded = new Map<string, ReadonlySet<string>>();
  return (tail, found) => {
    const last = lastTailCheckpoint(layout, tail);
    const key = last === undefined ? null : keys(last.signerFp);
    if (
      last !== undefined &&
      key !== null &&
      key.fingerprint() === last.signerFp &&
      checkpointBelongsToItsTail(tail, last) &&
      found.every((line) => line.seq <= last.toSeq) &&
      checkpointSignatureHolds(last, key.key)
    ) {
      return new Set(found.map((line) => line.hash));
    }
    let proven = folded.get(tail);
    if (proven === undefined) {
      const signing = signingOf(layout, tail, keys, undefined, proof ?? proofOf(layout));
      const read = readTail(layout, tail, upcasters, undefined, undefined, 'what holds');
      proven = signedOf(tail, read, keys, signing).proven;
      folded.set(tail, proven);
    }
    return proven;
  };
}

/**
 * Merges streams into one order ({@link causalOrder}, the chain's own merge) and says which
 * citations it could not place: the hashes cited that the streams' trees do not hold, which
 * the order ignored. The streams are read and never consumed, so one reading serves several
 * merges.
 *
 * `judged` leaves out the moves the workflow does not allow ({@link illegalMoves}) and the writings
 * of a decision that come before its text ({@link decisionTexts}), and says which in `left`. It is false only where the streams are of several trees, whose moves were
 * judged tree by tree already.
 */
function mergeStreams(
  streams: readonly TailStream[],
  judged = true,
): {
  readonly events: CatalogEvent[];
  readonly left: ReadonlySet<CatalogEvent>;
  readonly unresolved: string[];
} {
  const eventAt = (tail: number, position: number): CatalogEvent | UnreadEvent =>
    (streams[tail] as TailStream).events[position] as CatalogEvent | UnreadEvent;
  const merged = causalOrder(
    streams.map((stream) => ({
      tree: stream.tree,
      tail: stream.tail,
      length: stream.events.length,
    })),
    {
      at: (tail, position) => eventAt(tail, position).at,
      hash: (tail, position) => (streams[tail] as TailStream).hashes[position] as string,
      after: (tail, position) => eventAt(tail, position).after,
    },
  );
  const cursors = streams.map(() => 0);
  // A line of a kind this binary does not know held its place in the merge and leaves here: no
  // move is judged against it and no projection is handed it. Its position still counts, so a
  // citation of a line after it on its tail resolves where it did.
  const placed: { event: CatalogEvent; tail: number; position: number }[] = [];
  for (const tail of merged.steps) {
    const position = cursors[tail] as number;
    cursors[tail] = position + 1;
    const event = eventAt(tail, position);
    if (isCatalogEvent(event)) placed.push({ event, tail, position });
  }
  const illegal = judged ? illegalMoves(placed, merged.held) : new Map();
  // A decision is the text its first judgment saw (FORMAT.md section 6.8): a writing before that
  // text is left out, so the fold, which takes the first writing it meets, meets the text.
  const texts = judged ? decisionTexts(placed, merged.held, illegal) : new Map<string, number>();
  const events: CatalogEvent[] = [];
  const left = new Set<CatalogEvent>();
  placed.forEach((at, index) => {
    if (illegal.has(index) || precedesItsText(at, index, texts)) left.add(at.event);
    else events.push(at.event);
  });
  return {
    events,
    left,
    unresolved: [...new Set(merged.notHeld.map((citation) => citation.hash))],
  };
}
