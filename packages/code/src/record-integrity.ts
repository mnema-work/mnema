/**
 * What the product says about a record that does not chain: one wording, and one place
 * that holds it, for every door it answers through.
 *
 * THIS USED TO SAY "what a READ says about the record it just served", and the
 * restriction was real rather than loose phrasing: the reads got the rule and the MCP's
 * writes were left composing their own reply. That is false now, and what falsified it
 * is the case the restriction was weakest on: an append onto a tail that ALREADY does
 * not chain, where the agent is answered `Recorded decision …`, walks away believing it
 * put a fact into an intact record, and is the reader who will cite that id later. The
 * command line had ruled the other way from the start (`decision import` and `switch`
 * write and say so), so the restriction also meant one rule through two doors.
 *
 * ## Why a reader says anything at all
 *
 * It used to say nothing. Over a tree `mnema verify` exits 1 on (`seq gap: expected
 * 6, found 4`, which is what two sessions writing one tail at once used to leave)
 * `mnema search --kind decision` exited 0 with no word, and so did `mnema status`.
 * Every fact was there and every fact was served; the only thing missing was that the
 * record could no longer prove nothing had been inserted between them. A product
 * whose whole purpose is proof cannot hand somebody a broken proof in silence.
 *
 * ## Why it is a NOTICE and not a refusal
 *
 * Nothing is lost when a tail stops chaining, and that is not a consolation, it is the
 * shape of the damage: the entries are all on disk, all readable, all things somebody
 * wrote. Refusing the read would take a sound answer away over a broken proof, and the
 * exit stays zero for the same reason: the read DID answer, and ruling on the record
 * is a verb of its own. What changes is that nobody is left thinking the answer came
 * off an intact record.
 *
 * ## Why the words live HERE and not in either surface
 *
 * THIS MODULE USED TO BE `wiring/integrity.ts`, AND ITS OWN DOC SAID WHY IT BELONGED
 * THERE: *"IT LIVES IN THE WIRING, beside `verify.ts`, and not in `presentation/`,
 * because that is where the shape it copies lives."* That premise held for exactly as
 * long as the command line was the only reader told anything. It is false now: the MCP
 * serves the same record to an agent, the agent is this product's principal reader, and
 * a module under `wiring/` is one the MCP may not import; the dependency runs
 * surface-to-shared, never surface-to-surface. What falsified the premise is that the
 * notice got a SECOND door, which is the same thing that moved `record-framing.ts`,
 * `record-effect.ts` and `recorded-content.ts` out of both surfaces before it.
 *
 * What went with the move is only the WORDS. The `Line` form the command line prints
 * is still composed in `wiring/integrity.ts`, because the shape it copies (`verify`'s
 * issue line, out of `fact` and `onOneLine`) is still the wiring's. What that file no
 * longer holds is a sentence, so the two doors cannot come to say different things
 * about the same bytes.
 *
 * ## Where it goes, and in whose voice
 *
 * On the command line, to `err`, in the same shape `verify` gives an issue (`issue
 * [T1] <scope> <tail>#<seq>: <detail>`), because it IS that issue, reached by a
 * different road: the sentence comes from the chain's own rule (`linkBreakAt`), which
 * the verifier and the reader now both ask. A second wording here would be a second
 * opinion about the same bytes. The stream matters: `--json` consumers take stdout, and
 * a notice on stdout would corrupt the one output that surface promises is
 * machine-readable.
 *
 * Through the MCP, as its own text block BESIDE the payload or the acknowledgement
 * ({@link linkBreakBlock} for a read, {@link linkBreakBlockOnWrite} for a write), never
 * inside it: the same division `withRunState` already draws for what a read says about
 * the connection. Beside and not behind a second call: a channel that states half a fact
 * and points at a tool for the rest has stated nothing (`record-framing.ts` records the
 * measurement), and `verify` is not reachable from the MCP at all, so "call `verify`"
 * would be a pointer at a door the agent does not have.
 *
 * ## Why a write is told for a gap or a fork, and refused for an altered or an unreadable entry
 *
 * The record is append-only and a gap or a fork is BEHIND: the new event chains from the last hash
 * the tail held, so it is sound from there forward and nothing about it is made worse by landing.
 * Refusing would turn a broken chain into a stopped product, and a record whose purpose is to
 * survive the accident cannot decline to work after one. So for those two a write is told, and the
 * exit code and the `isError` flag stay what they were, for the reason they do on a read: the act
 * DID happen, and ruling on the record is a verb of its own.
 *
 * An entry whose hash does not hold, and a line no parser can open, are not behind. The first is a
 * line somebody changed and the second one this mnema cannot read, so the record's own proof of
 * what it says is gone at that line, and a new entry signed over it would be taken by the next
 * reader for the record's word on a record that no longer answers for itself. Those two are
 * REFUSED, by every write and by `switch off`, which is a write to the same record (ADR-396); the
 * words are `what-a-write-meets.ts`, and the reading around them degrades (they are left out of
 * the answer and said first).
 */

import type { RecordGroup, WithheldRun } from '@mnema/chain';
import type { NewerLines } from '@mnema/context';
import {
  acceptedAgainstRetired,
  type DivergentMove,
  divergenceSentence,
  type Scope,
} from '@mnema/core';
import { oneLine } from './one-line.js';

/**
 * A tail that does not chain, and which of the trees it is in.
 *
 * It is declared HERE, beside the words, rather than beside the reading that produces
 * it (`tree-sources.ts`, which re-exports it): the MCP asks that reading for the value
 * and this module for the sentence, and a type that lived with only one of them would
 * make the other import a surface's module to name its own argument.
 */
export interface ScopedLinkBreak {
  readonly scope: Scope;
  readonly tail: string;
  /** The seq the fact is about: absent for a part of the record that was not read (`unread`), which has none. */
  readonly seq?: number;
  readonly detail: string;
  /**
   * Present when the fact is an entry LEFT OUT of what was served because its hash does not
   * hold, and then where the line is: the segment's file name and the line in it. Absent for a
   * tail that stops chaining (a gap, a fork, a `prev` that names something else).
   */
  readonly retained?: { readonly segment: string; readonly line: number };
  /**
   * Present when the fact is a PART OF THE RECORD THIS MNEMA DOES NOT READ, which the answer was
   * served around: a line of a segment that does not parse, or a symbolic link (ADR-396, ADR-406).
   * `place` is where it is in the record, `line` the line of a line, `reason` why it is not read, and
   * `root` the directory of the tree's record, so the refusal of a write can say what it always said.
   */
  readonly unread?: {
    readonly kind: 'line' | 'link' | 'disk';
    readonly place: string;
    readonly line?: number;
    readonly reason: string;
    readonly root: string;
  };
  /**
   * Present when the fact is a run of a tail WITHHELD because no signature proves it (ADR-557 to
   * ADR-562): a checkpoint that does not hold over it, a signed event that is gone, checkpoints
   * this machine signed that are no longer in the file, or more unsigned events than one write
   * leaves. Fact A: the run was not served, and the gate and every write refuse while it stands.
   */
  readonly checkpoint?: WithheldRun;
  /**
   * Present when the fact is a run of a tail served and NOT signed by a checkpoint (Fact B): one
   * write's window at the tail's end, which governs nothing until a checkpoint covers it, or, with
   * `byNote`, events this machine's signed note vouches for, which govern.
   */
  readonly unsigned?: {
    readonly fromSeq: number;
    readonly toSeq: number;
    readonly count: number;
    readonly byNote: boolean;
  };
}

/**
 * What a reader who has never met a chain has to be told once, however many tails
 * broke: that the facts are all still there, and that there is a verb whose job is to
 * say how far the damage goes.
 *
 * It is a constant rather than a line built in {@link linkBreakSentences} so that the
 * MCP's own closing sentence can be checked against it: the agent has no `verify`, so
 * its block ends differently, and "differently" is only assertable against the thing it
 * differs from.
 */
const STILL_ON_THE_TAIL =
  'the records above are all still on the tail: what broke is the proof that nothing ' +
  'was inserted between them.';

/** How a person at a terminal is sent to the verb that rules on the whole record. */
const ASK_VERIFY = '`mnema verify` says how far it reaches.';

/**
 * How an agent is told the same thing, and it names no verb.
 *
 * `verify` is not one of this server's tools, so pointing at it would point at a door
 * this reader cannot open. What it can do is say so to the person it is working with,
 * which is the one move available and therefore the one named.
 */
const TELL_SOMEBODY =
  'The person you are working with can run `mnema verify` to see how far it reaches.';

/**
 * What is said once, however many entries were left out, when an entry's hash did not hold: that
 * it is NOT in the answer. The sentence about the records "still on the tail" would be false
 * for it, so a block that names one says this instead, and keeps the other sentence only for
 * the tails that stop chaining.
 */
const LEFT_OUT =
  'an entry named above was altered after it was written: this answer leaves it out, and ' +
  'what it said is not shown.';

/**
 * What is said once, however many runs were withheld, when a run is not proven by a signature of its
 * tail (ADR-557 to ADR-562): it is NOT in the answer, and the same standing as {@link LEFT_OUT}.
 */
const NOT_SIGNED_OUT =
  'an entry named above is not what its checkpoint signed: this answer leaves it out, and what it said is not shown.';

/**
 * What is said once, however many parts were left out, when a part of the record is one this mnema
 * does not read: that it is NOT in the answer, whatever it holds. The same standing as
 * {@link LEFT_OUT}, for the other way a part of the record is left out.
 */
const LEFT_UNREAD =
  'a part of the record named above is one this mnema does not read: this answer leaves it out, ' +
  'and what it holds is not shown.';

/**
 * What is said of a line of a tree the repository does not keep: it is not versioned, so there is no
 * history to put the line back from. The words a refusal of a write has always said of such a line
 * (`what-a-write-meets.ts`), which the reads say now too.
 */
export const NOT_VERSIONED =
  'This record is not versioned: update mnema if a newer one wrote the line, restore the file from a copy, or repair or remove the line named above.';

/** What a part this mnema does not read is, by its kind, as an issue line says it. */
const THE_PART = {
  line: 'a line that does not read',
  link: 'a symbolic link',
  disk: 'a part the disk does not let this mnema open',
} as const;

/** The way out of a part the disk does not let this mnema open: the part itself is to be put right, in any tree. */
export const DISK_WAY_OUT =
  'Give this user access to it, or put back the folder or file that belongs there.';

/** The way out of a part this mnema does not read, by its kind and the tree it is in (ADR-408). */
function wayOut(
  broken: ScopedLinkBreak & { readonly unread: NonNullable<ScopedLinkBreak['unread']> },
): string {
  if (broken.unread.kind === 'link') {
    return 'Replace the link with the folder or file it points to.';
  }
  // Nothing in the repository’s history puts a permission or a folder back, in any tree.
  if (broken.unread.kind === 'disk') return DISK_WAY_OUT;
  // Only the public tree is kept by the repository, so only its way out is a restore from history.
  return broken.scope === 'public'
    ? `Update mnema if a newer one wrote the line, or \`mnema tail repair ${oneLine(broken.tail)}\` puts it back from the repository’s history.`
    : NOT_VERSIONED;
}

/** One issue line per broken tail, in the shape `verify` gives an issue. */
function issueLines(breaks: readonly ScopedLinkBreak[]): readonly string[] {
  // Every value here came out of the record, so every value goes through the collapse:
  // a tail name or a detail carrying a newline would turn one issue into two lines, and
  // the second would read as an issue about a tail nobody named.
  return breaks.map((broken) => {
    if (broken.checkpoint !== undefined) return withheldLine(broken, broken.checkpoint);
    if (broken.unsigned !== undefined) return unsignedLine(broken, broken.unsigned);
    if (broken.unread !== undefined) {
      const where = `${oneLine(broken.unread.place)}${broken.unread.line === undefined ? '' : ` line ${oneLine(String(broken.unread.line))}`}`;
      const what = THE_PART[broken.unread.kind];
      return `issue [T1] ${oneLine(broken.scope)} ${oneLine(broken.tail === '' ? broken.unread.place : broken.tail)}: ${what} (${where}): ${oneLine(broken.unread.reason)}; this part was not read. ${wayOut({ ...broken, unread: broken.unread })}`;
    }
    const at = `issue [T1] ${oneLine(broken.scope)} ${oneLine(broken.tail)}#${oneLine(String(broken.seq))}: ${oneLine(broken.detail)}`;
    if (broken.retained === undefined) return at;
    // WHERE THE LINE IS and that it was not served: the entry's own text never rides here.
    return `${at} (${oneLine(broken.retained.segment)} line ${oneLine(String(broken.retained.line))}); this entry was not served`;
  });
}

/** The words for a scope, as the Fact B line names the tree. */
const THE_TREE: Readonly<Record<Scope, string>> = {
  public: 'the project’s public record',
  private: 'the project’s private record on this machine',
  global: 'this machine’s global record',
};

/**
 * One issue line for a run withheld because no signature proves it (Fact A), in the shape `verify`
 * gives an issue and with the words of the line that failed where one did.
 */
function withheldLine(broken: ScopedLinkBreak, run: WithheldRun): string {
  const head = (seq: number): string =>
    `issue [T2/T4] ${oneLine(broken.scope)} ${oneLine(broken.tail)}#${seq}:`;
  const range = `seq ${run.fromSeq} to ${run.toSeq}`;
  const line = run.line === undefined ? '' : `checkpoints.jsonl line ${run.line}`;
  switch (run.why) {
    case 'checkpoint':
      return `${head(run.fromSeq)} ${oneLine(run.detail ?? 'checkpoint failed')} (${line}, ${range}); these entries were not served`;
    case 'with-a-break':
      return `${head(run.fromSeq)} the checkpoint over ${range} (${line}) does not verify across the break this tail holds (${oneLine(run.detail ?? 'checkpoint failed')}), so ${range} were not served`;
    case 'missing-signed':
      return `${head(run.missing ?? run.fromSeq)} the checkpoint over ${range} (${line}) proves an event stood at seq ${run.missing ?? run.fromSeq}, and it is not in the tail; ${range} were not served`;
    case 'checkpoints-removed':
      return `${head(run.fromSeq)} the checkpoints this machine signed up to seq ${run.toSeq} are no longer in checkpoints.jsonl (the signed note in locks/ names checkpoint ${oneLine((run.noteCheckpoint ?? '').slice(0, 12))}...); ${range} were not served`;
    case 'unproven-beyond-one-write':
      return `${head(run.fromSeq)} ${eventsWord(run.toSeq - run.fromSeq + 1)} (${range}) ${run.toSeq === run.fromSeq ? 'is' : 'are'} covered by no signature, more than one write leaves or not at the tail’s end; these entries were not served`;
    case 'no-checkpoint':
      return `${head(0)} this tail holds ${eventsWord(run.toSeq - run.fromSeq + 1)} and no checkpoint that verifies; these entries were not served`;
  }
}

function eventsWord(count: number): string {
  return `${count} ${count === 1 ? 'event' : 'events'}`;
}

/** The line for a run served and not signed by a checkpoint (Fact B), last in the block. */
function unsignedLine(
  broken: ScopedLinkBreak,
  run: NonNullable<ScopedLinkBreak['unsigned']>,
): string {
  const one = run.count === 1;
  const where = `${eventsWord(run.count)} of ${THE_TREE[broken.scope]} (tail ${oneLine(broken.tail)}, seq ${run.fromSeq} to ${run.toSeq})`;
  if (run.byNote) {
    return `${where} ${one ? 'is' : 'are'} signed by this machine’s note of what it wrote and by no checkpoint: ${one ? 'it is' : 'they are'} served and ${one ? 'governs' : 'govern'} here, and this machine’s next write signs ${one ? 'it' : 'them'}.`;
  }
  return `${where} ${one ? 'is' : 'are'} recorded and not yet signed: ${one ? 'it is' : 'they are'} served and listed as such, and ${one ? 'it does' : 'they do'} not govern until a checkpoint signed by the tail’s key covers ${one ? 'it' : 'them'}.`;
}

/**
 * What closes the fact: what is true of the tails that stopped chaining (their records are all
 * on the tail) and of the entries left out (they are not in the answer), whichever are named.
 */
function closing(breaks: readonly ScopedLinkBreak[], next: string): string {
  const parts = [
    ...(breaks.some((broken) => broken.retained !== undefined) ? [LEFT_OUT] : []),
    ...(breaks.some((broken) => broken.checkpoint !== undefined) ? [NOT_SIGNED_OUT] : []),
    ...(breaks.some((broken) => broken.unread !== undefined) ? [LEFT_UNREAD] : []),
    ...(breaks.some(
      (broken) =>
        broken.retained === undefined &&
        broken.unread === undefined &&
        broken.checkpoint === undefined &&
        broken.unsigned === undefined,
    )
      ? [STILL_ON_THE_TAIL]
      : []),
  ];
  return `${parts.join(' ')} ${next}`;
}

/**
 * The sentences a read owes about the tails it served that do not chain: none at all
 * for a sound record, which is every record this product wrote on its own.
 *
 * The last sentence is not decoration. The ones before it say what is wrong with each
 * tail; a reader who has never met a chain needs to be told that the answer beside them
 * is still the facts, and that there is a verb whose job is to say how far the damage
 * goes. Told once, however many tails broke.
 */
export function linkBreakSentences(breaks: readonly ScopedLinkBreak[]): readonly string[] {
  if (breaks.length === 0) return [];
  // Events served and not yet signed are no broken proof: said alone, with no closing.
  if (breaks.every(isUnsigned)) return issueLines(breaks);
  return [...issueLines(breaks), closing(breaks, ASK_VERIFY)];
}

/** Whether a fact is only a run served and not signed by a checkpoint (Fact B). */
function isUnsigned(broken: ScopedLinkBreak): boolean {
  return broken.unsigned !== undefined;
}

/**
 * How a READ opens the block: the answer came OFF the record.
 *
 * It is a constant rather than a literal in {@link linkBreakBlock} for the reason
 * {@link STILL_ON_THE_TAIL} is one: the other opening has to be checkable against it,
 * and "the write says something different" is only assertable against the thing it
 * differs from.
 */
const CAME_OFF = 'The record this answer came off does not chain, so its proof is broken:';

/**
 * How a WRITE opens the block, and the clause is the whole difference.
 *
 * A read's answer came off the record; a write's fact went ONTO it, and that is the
 * case where being told matters most: the agent is handed `Recorded decision …`,
 * takes it for a fact in an intact record, and is the one who will cite that id later.
 * "Came off" would be simply false there: nothing came off, something landed.
 *
 * WHAT IT DOES NOT CLAIM is that the break is in the tree this particular write landed
 * in. The breaks come from {@link ScopedLinkBreak}s the session has read, which is the
 * same honest over-report the read carries ({@link linkBreakBlock}), and each issue
 * line NAMES its tree, so a reader whose write went to a sound private tree while the
 * public one is broken reads which is which off the lines, one block below the
 * `landedNotice` that says where the fact went.
 *
 * THERE ARE TWO OPENINGS AND THERE MAY NOT BE A THIRD. A wording for one more door
 * would be a second opinion about the same bytes, which is the thing this module exists
 * to prevent; `tests/the-broken-link-reaches-every-reader.test.ts` reads this file and
 * reddens on a third.
 */
const LANDED_ON = 'The record this landed on does not chain, so its proof is broken:';

/** The block itself, once the caller's door has said how it opens. */
function block(opening: string, breaks: readonly ScopedLinkBreak[]): readonly string[] {
  if (breaks.length === 0) return [];
  // Events served and not yet signed are no broken proof: they open no block of their own.
  if (breaks.every(isUnsigned)) return [issueLines(breaks).join('\n')];
  return [[opening, ...issueLines(breaks), closing(breaks, TELL_SOMEBODY)].join('\n')];
}

/**
 * The same fact as the text block an MCP read carries beside its payload: empty when
 * nothing broke, so a caller can splice it in without a branch of its own.
 *
 * ONE BLOCK AND NOT ONE PER TAIL, because a tool result is a list of blocks and a
 * reader meeting four of them has met four things to weigh rather than one fact with
 * four parts. It opens by saying what it is about, which the command line does not have
 * to: there the notice sits above the verb the person typed, and here it arrives in a
 * transcript beside the answers of every other call.
 */
export function linkBreakBlock(breaks: readonly ScopedLinkBreak[]): readonly string[] {
  return block(CAME_OFF, breaks);
}

/**
 * The same block as {@link linkBreakBlock}, for the reply to a WRITE: same issue
 * lines, same closing sentence, and the opening of {@link LANDED_ON}.
 *
 * It is a door of its own rather than a flag on the read's, because the two are asked
 * for at different moments by different composers, and a boolean at the call site
 * would read as a mode rather than as which of two things the caller is.
 */
export function linkBreakBlockOnWrite(breaks: readonly ScopedLinkBreak[]): readonly string[] {
  return block(LANDED_ON, breaks);
}

/**
 * The places that open the record and owe NO notice, each with the reason, because
 * "this one owes nothing" is a claim that has to be answerable.
 *
 * It is a table and not an absence for the reason `record-framing.ts`'s
 * `UNFRAMED_CHANNELS` is one: the guard
 * (`tests/the-broken-link-reaches-every-reader.test.ts`) walks the source for the ways
 * this package reaches a record at all, and a file that neither asks a reading that
 * carries the fact nor appears here is red. So a read added next year is classified or it
 * does not pass, and the classification is written down rather than re-derived from the
 * silence.
 *
 * THE UNIVERSE THAT SWEEP DEFINES USED TO BE THE PROJECTION CACHE ALONE: four ways of
 * opening one, AND THAT IS WHERE THE CONSOLE FELL OUT OF IT. The REPL serves the record:
 * it prints a verdict in its opening panel, holds the proven level in the corner of every
 * frame, and shows what another process appended while it was up. It opens no cache to do
 * any of it (it reaches the chain through `runVerify`, `chainExtent` and `readTailTip`)
 * so it was outside the guard's reach without being in this table with a reason, and the
 * corner went on saying `fully-signed` in the same frame whose body printed `seq gap`. The
 * sweep has a second discriminant now: the ways this package reads the CHAIN with no cache
 * in between. What was really wrong was not the missing entry; it was that the
 * discriminant carried the blind spot.
 *
 * THE KEY IS THE PATH UNDER `packages/code/src/`, because that is what the guard has to
 * read, and a name would have to be matched back to a file by a second rule.
 */
export const SERVES_NO_RECORD_CONTENT: { readonly [path: string]: string } = {
  'inherited-record.ts':
    'it opens ANOTHER repository’s record, never this project’s, and only after that record ' +
    'verified at the commit pointed at: a break there is the answer `unverified`, which the ' +
    'brief’s section says in words and prints no decision under, so a notice about this ' +
    'project’s chain has nothing to attach to',
  'commands/doctor.ts':
    'it reads the tails only to count the lines a newer mnema wrote that this one reads past, and ' +
    'serves no record content: its one finding about the record is that count, in a checklist ' +
    'about the machine, and whether the chain chains is `mnema verify`’s to say',
  'commands/decision.ts':
    'a decision is a write, answered by the write; the one thing it reads afterwards is the ' +
    'decisions the new one cites, to name the command that would replace each, and it serves no ' +
    'record content: a notice about the chain would be said to a caller who asked to record, ' +
    'while the reads that follow (`show`, `brief`) carry it',
  'commands/decision-transition.ts':
    'a move is a write, answered by the move; the one thing it reads first is where the ' +
    '`agent-accepts` switch stands, to turn an agent’s accept away, and it serves nothing of ' +
    'the record to anybody: a notice about the chain would be said to a caller who asked to ' +
    'change it, and the reads that follow (`show`, `brief`) carry it',
  'moved-record.ts':
    'it reads the one label a move echoes (the ADR number of a decision, the name of a skill) ' +
    'and whether a supersede’s successor is still proposed, after a write the caller asked for; ' +
    'it serves no record content, and a notice about the chain would be said to someone who ' +
    'asked to change it, while the reads that follow (`show`, `brief`) carry it',
  'commands/link.ts':
    'a link is a write, answered by the link; the one thing it reads after it is whether the ' +
    'subject is a task, to say where that subject lives, and it serves no record content: a ' +
    'notice about the chain would be said to a caller who asked to add a link, while the ' +
    'reads that follow (`refs`, `show`) carry it',
  'commands/check.ts':
    'it records results at a commit and reads the record only to know which rules are in ' +
    'force; what it serves is the verdict of each check, a notice about the chain would be ' +
    'said to a runner that asked for the results, and `mnema verify` rules on the chain in the ' +
    'same job',
  'commands/record-commit.ts':
    'it reads the record for two things: which decision `--through` names, and the label and ' +
    'state of each decision the cut moves, read off the cut tree only after `verify` at the ' +
    'signed level and `verify --since` ruled on that tree; a cut whose chain breaks is refused ' +
    'with what the readers said, and no branch is made, so a notice would have nothing left to ' +
    'attach to',
  'commands/commit-hook.ts':
    'it serves the title and label of each governing decision into a commit message file the ' +
    'person edits, as `#` lines git drops; that file is not a reading anyone asked the record ' +
    'for, and a notice about the chain would be one more comment in a message, with the ' +
    'hook’s own output sent to /dev/null so an error never costs the commit: `mnema verify` ' +
    'rules on the chain',
  'commands/after-a-write.ts':
    'a host runs it after a write and reads one line beside the result (an id, or a command), so a ' +
    'notice about the chain has nowhere to land; what it copies goes through `runMemory`, a write ' +
    'whose own answer is the record, and the same session opens with the document, which says it',
  'commands/corrections.ts':
    'a host runs it at the end of a response and reads one field of its reply (a line of ids), so a ' +
    'notice about the chain has nowhere to land; what it records goes through `runDecision`, a write ' +
    'whose own answer is the record, and the same session opens with the document, which says it',
  'commands/tally.ts':
    'a host runs it at the end of a response and reads one field of its reply (a line of two ' +
    'counts), so a notice about the chain has nowhere to land; the same session opens with the ' +
    'document, which says it, and `mnema verify` rules on it',
  'commands/dispatched.ts':
    'a host runs it after a dispatch and when a session ends and reads nothing of its reply (it prints `{}`), ' +
    'so a notice about the chain has nowhere to land; it opens the record only to read two switches and ' +
    'to write a task and its handoffs, whose own answer is the record, and `mnema verify` rules on it',
  'commands/handback.ts':
    'a host runs it when a subagent stops and reads one field of its reply (the reason the subagent ' +
    'is sent back with), so a notice about the chain has nowhere to land; `mnema verify` rules on it',
  'commands/settled.ts':
    'a host runs it after a question to the person was answered, and it opens the record only to ' +
    'read one switch; its reply is one sentence of the product’s own, so a notice about the chain ' +
    'has nowhere to land; the same session opens with the document, which says it',
  'anchors.ts':
    'it resolves a typed prefix into the anchor the CALLER was handed, and answers ' +
    'nobody: the verbs that use it are themselves on the list that owes the notice, so ' +
    'a notice here would be the same fact said twice in one invocation',
  'label-as-address.ts':
    'it turns an `ADR-<n>` the caller typed into the id of the one decision it names, or into the ' +
    'refusal that lists the ids when several carry it, and serves no record content: the verb ' +
    'that asked is on the list that owes the notice, so a notice here would be the same fact ' +
    'said twice in one invocation',
  'pinned-run.ts':
    'it checks that the run `MNEMA_RUN` names exists before a write is allowed to cite ' +
    'it: an ARGUMENT being validated, not an answer being served, and what it hands ' +
    'back is a yes or a refusal about the caller’s own environment',
  'mcp/cache-registry.ts':
    'it opens the caches a connection keeps warm and serves nobody; the reads that ask ' +
    'it for one are what carry the fact (`sessionLinkBreaks`)',
  'commands/verify.ts':
    'it IS the verdict this notice is a shortening of: it enumerates every issue a tail ' +
    'holds, T1 included, and asking it for the notice would be the verb quoting itself',
  'wiring/verify.ts':
    'it words and prints what `commands/verify.ts` ruled and reads no record of its own; ' +
    'a notice here would be the verdict carrying a summary of a line already in it',
  'commands/record-pull.ts':
    'it hands back the verdict of `commands/verify.ts` over the record the pull left, whole, and ' +
    'the pull prints each tree of it: a notice beside it would be that verdict said a second time',
  'commands/verify-github.ts':
    'it runs after the verdict, over the trees the verdict ruled on, and reads only those whose ' +
    'verdict was not a break: a tree whose chain does not close is named as not compared ' +
    'instead, so the notice would be the verdict above it said a second time',
  'commands/verify-sigstore.ts':
    'it runs after the verdict, over the trees the verdict ruled on, and reads only those whose ' +
    'verdict was not a break: a tree whose chain does not close is named as not read instead, ' +
    'so the notice would be the verdict above it said a second time',
  'commands/witness.ts':
    'its acts write witness files and refuse a tree below fully signed by the verifier\u2019s own ' +
    'verdict, which is where a break is said; what `witness sigstore` reads of the events is only ' +
    'whether an identity names the certificate\u2019s, and serves none of their content',
  'site/browser/entry.ts':
    'it IS the verdict, run in a page: it hands the chain\u2019s own sentence and every issue and ' +
    'census note to the page unchanged, so a notice about the chain would be that verdict ' +
    'carrying a summary of a line already in it',
  'repl/following.ts':
    'it reports what somebody ELSE appended since the session opened and rules on nothing' +
    ': two equal extents mean nothing observable moved, never that the chain is intact. ' +
    'What the console says about the PROOF is the badge in its corner, which asks ' +
    '`watchingTheProof` in one place (`repl/session.ts`); a second answer composed on this ' +
    'clock would be the same surface holding two opinions about the same bytes',
};

/**
 * The MCP tools that serve no record content, with the reason: the same claim as
 * {@link SERVES_NO_RECORD_CONTENT}, asked of the other surface.
 *
 * ONE ENTRY, AND IT IS THERE BECAUSE OF A MEASUREMENT RATHER THAN AN OPINION.
 * `rules_before_an_edit` does not answer a caller: it answers the HOST, as a
 * `PreToolUse` hook, and the host's contract for that reply was measured against the
 * real binary; anything that is not the hook-reply
 * JSON is discarded in silence, with no error and nothing reaching the model. A notice
 * spliced into that reply would be read by nobody. The same answer asked for rather than
 * pushed is `governing_rules`, and that one carries it.
 */
export const TOOLS_SERVING_NO_RECORD_CONTENT: { readonly [tool: string]: string } = {
  rules_before_an_edit:
    'its reply is a hook reply the HOST parses, not an answer a model reads: measured ' +
    'against the real binary, anything that is not the reply JSON is discarded in ' +
    'silence, so a notice here would reach nobody',
};

/**
 * What a read says of a record whose moves did not see each other: one move out of one state, two
 * or more times, by machines that were apart. The words are here, beside the link-break sentences,
 * for the reason those are: the command line (`show`, through `wiring/integrity.ts`) and the MCP
 * (`read_record`, `bootstrap`) serve the same record, and a second wording would be a second
 * opinion about the same bytes.
 *
 * It names every move out of the state, picks none, and says which one the answer shows. Every
 * value in it came out of the record, so each goes through {@link oneLine}.
 *
 * It says the moves did NOT SEE each other, which is what the reading holds it to: two moves out
 * of one state where the writer of the second had seen the first are not a divergence but a move
 * the workflow does not allow, which no reader applies and `verify` names (FORMAT.md section 6.7).
 */
export function movedApartSentence(move: DivergentMove): string {
  // An accept against a retirement is not "the last one wins": the decision is in force under
  // neither, and says so in the one line every reading of the rules gives (ADR-121).
  if (acceptedAgainstRetired(move)) return `this decision: ${divergenceSentence(move)}.`;
  return `this ${move.kind} left ${oneLine(move.from)} more than once: to ${oneLine(move.to.join(', then '))}, by moves on machines that had not seen each other. Each is a signed fact of the record; the state shown is the last of them in its order.`;
}

/**
 * THE ONE SENTENCE FOR A DIRECTORY THAT HOLDS TAILS OF MORE THAN ONE RECORD, for every surface that
 * says what governs: the brief, `rules` and `governing_rules`, the rules pushed at a write,
 * `bootstrap`, and the Action through `rules --json`. Its tails name two records or more, so a
 * reading of it reads no tail (`tailsReadAt`, `@mnema/chain`) and nothing in it governs; a reading
 * that said nothing would read as a record with no rules. It names each record by the first twelve
 * characters of its name, with its tails, says that `verify` refuses the directory, and that
 * nothing governs until it holds one record
 * (`code/tests/a-directory-of-two-records-governs-nothing.test.ts`).
 */
export function severalRecordsSentence(groups: readonly RecordGroup[]): string {
  const each = groups.map(
    (group) =>
      `${oneLine(group.name.slice(0, 12))} (${group.tails.length === 1 ? 'tail' : 'tails'} ${group.tails.map(oneLine).join(', ')})`,
  );
  return `This directory holds tails of ${groups.length} records: ${each.join('; ')}. \`mnema verify\` refuses it (another-record), and nothing in it governs here until it holds one record.`;
}

/** How many kinds a sentence about lines a newer mnema wrote names before it counts the rest. */
const KINDS_NAMED = 3;
/**
 * A kind's name is what a newer writer chose, of any length. Up to this many characters it is
 * quoted whole; past it, its first and last {@link KIND_ENDS} characters are, with the cut marked
 * between, so kinds that share a long prefix (`vendor.area.thing.v2.created`, `...updated`) still
 * read differently.
 */
const KIND_QUOTED = 64;
const KIND_ENDS = 30;

function linesWord(count: number): string {
  return `${count} ${count === 1 ? 'line' : 'lines'}`;
}

/** The kinds, each with its count, as one clause: the first few, then how many more. */
function kindsClause(newer: NewerLines): string {
  const named = newer.kinds.slice(0, KINDS_NAMED).map((one) => {
    const kind = oneLine(one.kind);
    const quoted =
      kind.length > KIND_QUOTED
        ? `${kind.slice(0, KIND_ENDS)}...${kind.slice(kind.length - KIND_ENDS)}`
        : kind;
    return `${one.lines} of ${JSON.stringify(quoted)}`;
  });
  const more = newer.kinds.length - named.length;
  return more > 0 ? `${named.join(', ')}, and ${more} more kinds` : named.join(', ');
}

/**
 * What every surface says when a newer mnema wrote lines this one reads past: how many, of which
 * kinds, that this binary applies none of them, and the one thing to do (ADR-140). The lines were
 * checked by `verify` and what they say was not read, so the sentence says no more of them than
 * their kinds, and it tells nobody to act on them: updating mnema is what reads them, and a reader
 * who cannot read a line does not guess what it says.
 *
 * ONE SENTENCE FOR THE OPENING READS (status, its `--json` and the brief carry the structure,
 * `bootstrap` and the brief this text) and one for a single record ({@link newerLinesAboutSentence}),
 * and both are held by `code/tests/a-record-says-where-a-newer-mnema-wrote.test.ts`.
 */
export function newerLinesSentence(newer: NewerLines): string {
  return (
    `A newer mnema wrote ${linesWord(newer.lines)} into this record (${kindsClause(newer)}) that this one ` +
    'does not read or apply, so what it serves from this record may be out of date. Update mnema to read them, and do not guess what they say.'
  );
}

/** {@link newerLinesSentence} for the lines whose subject is the one record a reading serves. */
export function newerLinesAboutSentence(newer: NewerLines): string {
  return (
    `A newer mnema wrote ${linesWord(newer.lines)} about this record (${kindsClause(newer)}) that this one ` +
    'does not read or apply, so what it shows of this record may be out of date. Update mnema to read them, and do not guess what they say.'
  );
}
