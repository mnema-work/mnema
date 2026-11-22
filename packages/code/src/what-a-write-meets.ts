/**
 * What a write MEETS before it happens: a refusal, a pause for a person, or nothing, decided
 * in one place for every host.
 *
 * Two relations of the record can stop a write. `asks-for-a-person` holds it until somebody
 * decides; `refuses-a-write` does not let it happen. A host's hook asks this function about
 * the paths one write touches and answers in its own shape; none of them decides which grade
 * applies, because a second reading of that is how one host would ask where another refuses
 * for the same file.
 *
 * THE ORDER IS THE WHOLE RULE, and it is written here and nowhere else: if any path of the
 * write is refused by a rule in force, the write is REFUSED, and only the refusals are carried;
 * no person is asked about a write that will not happen, so nothing from this answer may be
 * recorded as an asking. Only when nothing refuses does the asking apply, through
 * {@link whatAWriteAsks}, unchanged.
 *
 * THE SWITCHES ARE READ HERE, before either grade is decided, so no caller can refuse past a
 * refusal somebody switched off. Off, the refusal falls to whatever else the path meets: a rule
 * that asks for a person still asks.
 *
 * IT IS PURE OVER WHAT IT IS HANDED: the trees' caches and the paths. It records nothing; the
 * caller appends one `channel.refused` (or `channel.asked`) per rule of {@link WriteVerdict.at}
 * before it answers the host, and answers the same whether or not they land ({@link recordTheCharge}).
 */

import { join, sep } from 'node:path';
import {
  CodedError,
  DEFAULT_WAIT_MS,
  LinkedRecordError,
  TailBusyError,
  UnreadableDiskError,
  UnreadableLineError,
} from '@mnema/chain';
import {
  channelIsOn,
  newerLinesOf,
  type PushedRule,
  type RulesAtPath,
  ruleTree,
  type ScopedCache,
} from '@mnema/context';
import {
  ASKS_FOR_A_PERSON_RELATION,
  acceptedAgainstRetired,
  divergenceSentence,
  GOVERNS_RELATION,
  REFUSES_A_WRITE_RELATION,
  type Scope,
} from '@mnema/core';
import { whatAWriteAsks } from './edit-asks-a-person.js';
import { editRefusesNotice } from './edit-refuses-a-write.js';
import {
  type GovernedRead,
  onceBySpecificity,
  placesOfAPath,
  readRefusesAWriteAt,
  readRulesInForceAt,
} from './governed-tree.js';
import { oneLine } from './one-line.js';
import { ASKS_A_PERSON_CHANNEL, REFUSES_A_WRITE_CHANNEL } from './record-framing.js';
import {
  DISK_WAY_OUT,
  linkBreakSentences,
  NOT_VERSIONED,
  newerLinesSentence,
  type ScopedLinkBreak,
} from './record-integrity.js';

/** A rule in force at a path and the relation it holds there: what it does to the path. */
export interface RuleInForceUnder extends PushedRule {
  readonly relation:
    | typeof GOVERNS_RELATION
    | typeof REFUSES_A_WRITE_RELATION
    | typeof ASKS_FOR_A_PERSON_RELATION;
}

/**
 * EVERY rule in force at a path, whichever relation it holds there (`governs`, `refuses-a-write`,
 * `asks-for-a-person`), each saying which: what a reader that TELLS what stands over a path
 * (`mnema why`) reads. The push reads `governs` alone, because a refusal and a request have their
 * own channels; a reader that asked what stands over a file and left those two out would say
 * "nothing" for a path the gate refuses.
 *
 * IT LIVES HERE because which rules refuse and which ask is decided in this module and nowhere
 * else (`the-gate-is-decided-once.test.ts`). It reads what the record holds and does not consult
 * the switches: a channel switched off stops the gate from applying a rule, not the rule from
 * standing in the record, and a reader that hid it would be telling a person the file is free.
 * The places are the gate's own ({@link placesOfAPath}).
 */
export function everyRuleInForceAt(
  sources: readonly ScopedCache[],
  read: GovernedRead,
): {
  readonly path: string;
  readonly relative?: string;
  readonly rules: readonly RuleInForceUnder[];
} {
  const places = placesOfAPath(read);
  const under = (
    relation: RuleInForceUnder['relation'],
    reading: (path: string) => RulesAtPath | undefined,
  ): { first: RulesAtPath | undefined; rules: RuleInForceUnder[] } => {
    const readings = places.map(reading);
    return {
      first: readings[0],
      rules: readings.flatMap((one) => (one?.rules ?? []).map((rule) => ({ ...rule, relation }))),
    };
  };
  const governs = under(GOVERNS_RELATION, (path) => readRulesInForceAt(sources, { ...read, path }));
  const refuses = under(REFUSES_A_WRITE_RELATION, (path) =>
    readRefusesAWriteAt(sources, { ...read, path }),
  );
  const asks = under(
    ASKS_FOR_A_PERSON_RELATION,
    (path) => whatAWriteAsks(sources, { ...read, path })?.asked,
  );
  const first = governs.first as RulesAtPath;
  return {
    path: first.path,
    ...(first.relative !== undefined ? { relative: first.relative } : {}),
    rules: onceBySpecificity(
      [refuses.rules, asks.rules, governs.rules],
      (rule) => `${rule.relation}\0${rule.id}`,
    ),
  };
}

/**
 * The one line a gate, a push or an asked reading owes when a rule it names was moved out of one
 * state more than once by machines that had not seen each other (`movedApartSentence` says the
 * same of one record to `show`, `read_record` and the brief, from the same `divergentMoves`).
 * `undefined` for every other rule, which is every rule one machine moved.
 *
 * IT CHANGES NO VERDICT: the state a rule is in force under is the last move in the record's
 * order, and the gate applies it as it stands. The line says that the state was disputed, so a
 * person refused by it can read the moves before deciding the refusal is right.
 */
export function movedApartLine(
  sources: readonly ScopedCache[],
  rules: readonly { readonly id: string }[],
): string | undefined {
  const named = new Set(rules.map((rule) => rule.id));
  if (named.size === 0) return undefined;
  const apart = new Set<string>();
  const out = new Map<string, string>();
  for (const source of sources) {
    for (const move of source.cache.divergentMoves()) {
      if (!named.has(move.entityId)) continue;
      // An accept against a retirement is not "the last of them stands": the decision is in force
      // under neither, and its line is the one every reading of the rules gives (ADR-121).
      if (acceptedAgainstRetired(move)) out.set(move.entityId, divergenceSentence(move));
      else apart.add(move.entityId);
    }
  }
  const lines = [
    ...(apart.size === 0
      ? []
      : [
          `Moved apart: ${[...apart].map((id) => `\`${oneLine(id)}\``).join(', ')} left one state more than once, by moves on machines that had not seen each other; ` +
            'the rule stands as the last of them in the record leaves it, and `mnema show <id>` names the moves.',
        ]),
    ...[...out].map(([id, why]) => `Not in force: \`${oneLine(id)}\`: ${why}.`),
  ];
  return lines.length === 0 ? undefined : lines.join('\n');
}

/** One write, as a hook sees it: every path it touches, and where they are read from. */
export interface AWrite {
  /** The paths the write touches, as the host named them: relative or absolute. */
  readonly paths: readonly string[];
  /** The project's root directory: the parent of its `.mnema/`, absolute. */
  readonly root: string;
  /** The directory a relative path is resolved against (see `GovernedRead.from`). */
  readonly from: string;
}

/** What the write meets: the grade, the paths and rules behind it, and the reason to hand over. */
export interface WriteVerdict {
  /** `refuse`: the write does not happen; `ask`: it waits for a person. */
  readonly grade: 'refuse' | 'ask';
  /**
   * The paths that met this grade, each with the rules in force there under that grade's
   * relation, in the order the write named them. A path that met nothing is not here, and
   * under `refuse` neither is a path that only asked.
   */
  readonly at: readonly RulesAtPath[];
  /** The reason a host hands the agent: one notice per path, separated by a blank line. */
  readonly reason: string;
  /** The notices that make up {@link reason}, one per entry of {@link at}, in the same order. */
  readonly notices: readonly string[];
  /**
   * What a newer mnema wrote that this one reads past, in the words every surface says it in, when
   * it wrote any (ADR-140): a refusal or a request for a person is told what the rule it cites may
   * have lost to a line this binary cannot read, and a write that goes through is told nothing.
   */
  readonly newer?: string;
}

/** The facts of one tree: the paths and rules whose facts are written there. */
export interface FactsOfATree {
  /** The tree the rules' facts go to. */
  readonly tree: Scope;
  /** The paths that met a rule held by that tree, each with only those rules. */
  readonly at: readonly RulesAtPath[];
}

/**
 * Splits what a write met by the tree that holds each rule: a fact a rule causes is written to the
 * rule's own tree, so the id of a rule that does not travel never reaches the tree a clone gets.
 * The order of paths and of rules is kept inside each tree, and the trees come in the order their
 * first rule appears.
 */
export function factsByTree(ats: readonly RulesAtPath[]): readonly FactsOfATree[] {
  const trees = new Map<Scope, RulesAtPath[]>();
  for (const at of ats) {
    for (const tree of new Set(at.rules.map(ruleTree))) {
      const rules = at.rules.filter((rule) => ruleTree(rule) === tree);
      trees.set(tree, [...(trees.get(tree) ?? []), { ...at, rules }]);
    }
  }
  return [...trees].map(([tree, at]) => ({ tree, at }));
}

/** How many times a session hears a rule's notice whole before it is told in one line. */
export const NOTICES_SAID_WHOLE = 3;

/**
 * The reason to hand the agent for `met`, with a rule that has already spoken
 * {@link NOTICES_SAID_WHOLE} times in this session told in one numbered line instead of the
 * whole notice again. `seen` is the session's count of how often each rule has been told, per
 * grade, and this call adds to it.
 *
 * The rule is that no two refusals of one session are the same
 * text: the number is the order of the telling, and the line carries only the rule ids and the
 * path, never recorded prose. A notice is shortened only when EVERY rule behind it has spoken
 * more than the allowed times, so a rule met for the first time is always said whole.
 */
export function reasonTold(met: WriteVerdict, seen: Map<string, number>): string {
  const told = met.at.map((at, index) => {
    const orders = at.rules.map((rule) => {
      const key = `${met.grade}:${rule.id}`;
      const order = (seen.get(key) ?? 0) + 1;
      seen.set(key, order);
      return order;
    });
    const order = Math.min(...orders);
    if (orders.length === 0 || order <= NOTICES_SAID_WHOLE) return met.notices[index] as string;
    const verb = met.grade === 'refuse' ? 'refuses' : 'asks for a person';
    const ids = at.rules.map((rule) => oneLine(rule.id)).join(', ');
    return `#${order}: ${ids} ${verb} at ${oneLine(at.relative ?? at.path)} again; the notice is the one above.`;
  });
  return (met.newer === undefined ? told : [...told, met.newer]).join('\n\n');
}

/**
 * What `write` meets over `sources`, or `undefined`, the ordinary case, when it meets
 * nothing: no rule in force refuses or asks at any of its paths, or the channel that would
 * have spoken is switched off.
 */
export function whatAWriteMeets(
  sources: readonly ScopedCache[],
  write: AWrite,
): WriteVerdict | undefined {
  const read = (path: string) => ({ path, root: write.root, from: write.from });
  // EVERY PATH IS MET TWICE WHEN A LINK MAKES IT TWO: as the host wrote it, and as it really is
  // inside the project (`realPathInside`). A rule about a file is a rule about its bytes, so a
  // write through a link meets the rules of what the link leads to, the refusal still before the
  // asking. Two spellings that land on one address are one meeting, never two recorded facts.
  const places = write.paths.flatMap((path) => placesOfAPath(read(path)));
  const once = <T extends { readonly at: RulesAtPath }>(met: readonly T[]): T[] => {
    const seen = new Set<string>();
    return met.filter(({ at }) => {
      const key = at.relative ?? at.path;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  // THE SWITCHES ARE THE PROJECT'S OWN: a record the project inherits is read for its rules and
  // never for its switches, so the origin cannot turn this project's gate off.
  const own = sources.filter((source) => source.inherited === undefined);
  if (channelIsOn(own, REFUSES_A_WRITE_CHANNEL)) {
    const refused = places.flatMap((path) => {
      const at = readRefusesAWriteAt(sources, read(path));
      const notice = editRefusesNotice(at);
      return notice === undefined ? [] : [{ at, notice }];
    });
    if (refused.length > 0) return verdict(sources, 'refuse', once(refused));
  }

  if (!channelIsOn(own, ASKS_A_PERSON_CHANNEL)) return undefined;
  const asked = places.flatMap((path) => {
    const gate = whatAWriteAsks(sources, read(path));
    return gate === undefined ? [] : [{ at: gate.asked, notice: gate.notice }];
  });
  return asked.length > 0 ? verdict(sources, 'ask', once(asked)) : undefined;
}

/**
 * The reason a write is refused when reading the record met a stored line the reader refuses,
 * or `undefined` for anything else that was thrown, which the caller throws on. `trees` are the
 * trees the caller read, and the one whose chain holds the line's file is the tree it names.
 *
 * WHAT THE WRITE MEETS IS READ FROM THE RECORD, so a record that cannot be read cannot say the
 * write meets nothing: the gate refuses rather than answering a silence the host would read as
 * leave to write. The reason says which tree and which line, in the reader's own words
 * (`FORMAT.md` §7.1: never guessed at, never skipped), how far the refusal reaches (the
 * project, or for the machine-global tree every project on the machine) and the ways out, which
 * differ because only the public tree is kept by the repository. Switching the refusal off is
 * not one of them: the switch reads the same record.
 *
 * ONLY THAT LINE. A busy tail is the charge's to wait out ({@link recordTheCharge}), and a fault of
 * the product is a fault, never a refusal: neither is turned into one here.
 */
export function refusalOfAnUnreadableRecord(
  error: unknown,
  trees: readonly Pick<ScopedCache, 'scope' | 'chainRoot'>[],
): string | undefined {
  if (!(error instanceof UnreadableLineError)) return undefined;
  const tree = treeOfTheLine(error.locus, trees) ?? 'unknown';
  if (error instanceof LinkedRecordError) {
    return [
      `The write is refused: ${UNREADABLE_IN[tree].tree} holds a symbolic link, so which rules apply to this path cannot be known.`,
      error.message,
      LINKED_WAY_OUT[tree],
    ].join('\n\n');
  }
  if (error instanceof UnreadableDiskError) {
    return [
      `The write is refused: ${treeOfThePart(error, tree)} holds a part the disk does not let this mnema open, so which rules apply to this path cannot be known.`,
      saidWhere(error, tree),
      DISK_WAY_OUT_OF[tree],
    ].join('\n\n');
  }
  const words = UNREADABLE_IN[tree];
  return [
    `The write is refused: a line of ${words.tree} cannot be read by this mnema, so which rules apply to this path cannot be known.`,
    error.message,
    words.out(tailsOfTheLocus(error.locus)),
  ].join('\n\n');
}

/**
 * The refusal of an act that records something (a decision, a note, a task) over a part of the record
 * the disk does not let this mnema open. It is not about a path, as the refusal of a write before an
 * edit is: the act names none, so the sentence says the record cannot be written, where it is, and the
 * way out. `trees` are the trees the caller read, as for {@link refusalOfAnUnreadableRecord}.
 */
export function refusalOfAPartForARecordingAct(
  error: UnreadableDiskError,
  trees: readonly Pick<ScopedCache, 'scope' | 'chainRoot'>[],
): string {
  const tree = treeOfTheLine(error.locus, trees) ?? 'unknown';
  return [
    `${treeOfThePart(error, tree)} holds a part the disk does not let this mnema open, so the record cannot be written.`,
    saidWhere(error, tree),
    DISK_WAY_OUT_OF[tree],
  ].join('\n\n');
}

/**
 * The reason a write is refused while an entry of the record was altered after it was written (its
 * hash does not hold), or `undefined` when no tree has one. It is the gate's answer to ADR-395:
 * which rules apply to a path is read from the record, and a record with an altered line cannot
 * say it, so the write waits for the line to be put back rather than going through on a reading
 * that left the line out.
 *
 * It names each entry (tree, tail, seq, the file and the line) and how far the refusal reaches,
 * and the way out, which differs by tree for the reason {@link UNREADABLE_IN} says: only the public
 * tree is kept by the repository. It is about the ALTERED line only: a gap, a fork or an unsigned
 * event is served and said, never refused here (ADR-395), so the breaks are not read.
 */
export function refusalOfAnAlteredRecord(facts: readonly ScopedLinkBreak[]): string | undefined {
  // A part of the record this mnema does not read is refused in the words an unreadable line always
  // was, now that the read serves around it (ADR-396): the gate says no, and the way out.
  const unread = facts.find((fact) => fact.unread !== undefined);
  if (unread !== undefined) {
    return refusalOfAnUnreadableRecord(unreadableErrorOf(unread), [
      { scope: unread.scope, chainRoot: (unread.unread as { root: string }).root },
    ]);
  }
  const altered = facts.filter((fact) => fact.retained !== undefined);
  if (altered.length === 0) return unsignedRefusal(facts, 'The write is refused');
  const trees = [...new Set(altered.map((fact) => fact.scope))];
  return [
    `The write is refused: ${trees.map((tree) => ALTERED_IN[tree].tree).join(' and ')} holds an entry that was altered after it was written, so which rules apply to this path cannot be known.`,
    ...linkBreakSentences(altered),
    ...trees.map((tree) => ALTERED_IN[tree].out(tailsOf(altered, tree))),
  ].join('\n\n');
}

/**
 * What a write meets where a run of the record is withheld because no signature proves it (Fact A,
 * ADR-561): which rules apply cannot be known from a record whose signed facts do not hold, so the
 * gate and every write refuse, as for an altered entry, until the tail is as it was signed.
 */
function unsignedRefusal(facts: readonly ScopedLinkBreak[], opening: string): string | undefined {
  const withheld = facts.filter((fact) => fact.checkpoint !== undefined);
  if (withheld.length === 0) return undefined;
  const trees = [...new Set(withheld.map((fact) => fact.scope))];
  const why = withheld.some((fact) => fact.checkpoint?.why === 'missing-signed')
    ? 'a signed fact that is missing'
    : withheld.every(founding)
      ? 'a tail no checkpoint signs yet'
      : withheld.every(
            (fact) =>
              fact.checkpoint?.why === 'unproven-beyond-one-write' ||
              fact.checkpoint?.why === 'no-checkpoint',
          )
        ? 'events no signature covers, more than one write leaves'
        : 'a signed checkpoint that does not verify';
  const cannotBeKnown =
    opening === 'The write is refused' ? ', so which rules apply to this path cannot be known' : '';
  return [
    `${opening}: ${trees.map((tree) => ALTERED_IN[tree].tree).join(' and ')} holds ${why}${cannotBeKnown}.`,
    ...linkBreakSentences(withheld),
    ...trees.map((tree) => UNSIGNED_IN[tree](withheld.filter((fact) => fact.scope === tree))),
  ].join('\n\n');
}

/** Whether a withheld run is a tail that holds events and no checkpoint that verifies. */
function founding(fact: ScopedLinkBreak): boolean {
  return fact.checkpoint?.why === 'no-checkpoint';
}

/** The tails named as a path of the public tree: `tails/<id>/`, joined by "and". */
function tailPaths(facts: readonly ScopedLinkBreak[]): string {
  return [...new Set(facts.map((fact) => fact.tail))].map((tail) => `tails/${tail}/`).join(' and ');
}

/**
 * The way out of a run no signature proves, by tree (ADR-408): only the public tree is in git.
 *
 * A public tail that holds events and no checkpoint is what a tail committed right after its first
 * write, before the checkpoint that write signs, looks like in a clone: putting it back as committed
 * changes nothing there, and what signs it is one more write of the machine that wrote it, which
 * its own signed note lets write. So that tail is told that way first, and `mnema tail repair`, which
 * puts a whole tail back from history (ADR-559), stays for a checkpoint that was committed and is
 * gone, and for every other run.
 */
const UNSIGNED_IN: Readonly<Record<Scope, (withheld: readonly ScopedLinkBreak[]) => string>> = {
  public: (withheld) => {
    const founded = withheld.filter(founding);
    const altered = withheld.filter((fact) => !founding(fact));
    return [
      ...(altered.length === 0
        ? []
        : [
            `Every write in the project is refused until the tail is as it was signed: ${repairWords(altered.map((fact) => fact.tail))} puts it back from the repository’s history, then run \`mnema verify\`.`,
          ]),
      ...(founded.length === 0
        ? []
        : [
            `Every write in the project is refused until a checkpoint signed by the tail’s key covers ${tailPaths(founded)}: on the machine that wrote it, write once more in this project, which signs one, and commit ${tailPaths(founded)}; then run \`mnema verify\`. If the repository committed a checkpoint of ${tailPaths(founded)} that is no longer there, ${repairWords(founded.map((fact) => fact.tail))} puts it back instead.`,
          ]),
    ].join('\n\n');
  },
  private: () =>
    `Every write in the project is refused until the tail is as it was signed. ${NOT_VERSIONED_ALTERED}`,
  global: () =>
    `This closes every project on this machine: every write in each is refused until the tail is as it was signed. ${NOT_VERSIONED_ALTERED}`,
};

const NOT_VERSIONED_ALTERED =
  'This record is not versioned: restore the file from a copy, or repair or remove the line named above.';

/** What the refusal says of each tree, for an altered entry: which it is, how far it reaches, the way out. */
const ALTERED_IN: Readonly<
  Record<Scope, { tree: string; out: (tails: readonly string[]) => string }>
> = {
  public: {
    tree: 'the project’s public record',
    out: (tails) =>
      `Every write in the project is refused until the line is as it was written: ${repairWords(tails)} puts it back from the repository’s history.`,
  },
  private: {
    tree: 'the project’s private record on this machine',
    out: () =>
      `Every write in the project is refused until the line is as it was written. ${NOT_VERSIONED_ALTERED}`,
  },
  global: {
    tree: 'this machine’s global record',
    out: () =>
      `This closes every project on this machine: every write in each is refused until the line is as it was written. ${NOT_VERSIONED_ALTERED}`,
  },
};

/**
 * `mnema tail repair <tail>` for each of `tails`: the verb that puts a line of the committed public tree
 * back from git (ADR-398), named only where the tree is the public one (ADR-408).
 */
function repairWords(tails: readonly string[]): string {
  return [...new Set(tails)].map((tail) => `\`mnema tail repair ${tail}\``).join(' and ');
}

/** The tails of the facts that name `tree`. */
function tailsOf(facts: readonly ScopedLinkBreak[], tree: Scope): string[] {
  return facts.filter((fact) => fact.scope === tree).map((fact) => fact.tail);
}

/**
 * The tail whose segment a locus names (`<...>/tails/<tail>/000001.jsonl line 3`), when it is a segment
 * of a tail: the only file `mnema tail repair` puts a line back in. The checkpoints are not one.
 */
function tailsOfTheLocus(locus: string): string[] {
  const named = /[\\/]tails[\\/]([^\\/]+)[\\/]\d+\.jsonl (?:line|byte offset) \d+$/.exec(locus);
  return named === null ? [] : [named[1] as string];
}

/**
 * The way out of a refusal for a symbolic link in a record, by tree and by how far it reaches: the link
 * is replaced with the folder or file it points to, because a record is read from its own files.
 */
const LINKED_WAY_OUT: Readonly<Record<Scope | 'unknown', string>> = {
  public:
    'Every write in the project is refused until the link is gone: replace the link with the folder or file it points to.',
  private:
    'Every write in the project is refused until the link is gone: replace the link with the folder or file it points to. This record is not versioned.',
  global:
    'This closes every project on this machine: every write in each is refused until the link is gone. Replace the link with the folder or file it points to. This record is not versioned.',
  unknown:
    'Every write that reads this record is refused until the link is gone: replace the link with the folder or file it points to.',
};

/** The note on the second stream beside that refusal. */
export const ALTERED_RECORD_NOTE =
  'The record holds an altered entry, so the write was refused and nothing was recorded.';

/**
 * The refusal of a WRITE while an entry of the record was altered after it was written (ADR-396):
 * thrown by the door of the command line and by the one door of the agent's tools before anything
 * is opened for writing, and answered by each as every refusal the product wrote on purpose is
 * (`Refused (ALTERED_ENTRY)` for an agent, the code on the first line of the error stream for a
 * hook). Reading degrades around such an entry; writing does not, because a new entry signed over a
 * record that no longer proves itself would be taken by the next reader for the record's own word.
 */
export class AlteredEntryError extends CodedError {
  readonly code = 'ALTERED_ENTRY';
  override readonly name = 'AlteredEntryError';
}

/**
 * What a write says when it met an entry whose hash does not hold, or `undefined` when no tree
 * has one: each entry (tree, tail, seq, the file and the line), how far the refusal reaches and the
 * way out, which differs by tree for the reason {@link ALTERED_IN} says (only the public tree is
 * kept by the repository, so only its way out is a restore from history, by `tail repair`). Every write is refused until the line is as it was written, and so is `switch off`: the
 * switch is a fact of the same record. A gap or a fork is not read here: it is told, never refused.
 */
export function alteredEntrySentence(facts: readonly ScopedLinkBreak[]): string | undefined {
  const unread = facts.find((fact) => fact.unread !== undefined);
  if (unread !== undefined) {
    return unreadableLineSentence(unreadableErrorOf(unread), [
      { scope: unread.scope, chainRoot: (unread.unread as { root: string }).root },
    ]);
  }
  const altered = facts.filter((fact) => fact.retained !== undefined);
  if (altered.length === 0) {
    const refused = unsignedRefusal(facts, 'Nothing was done');
    return refused === undefined
      ? undefined
      : `${refused}\n\nSwitching a channel off is a write to the same record, so it is refused too.`;
  }
  const trees = [...new Set(altered.map((fact) => fact.scope))];
  return [
    `Nothing was done: ${trees.map((tree) => ALTERED_IN[tree].tree).join(' and ')} holds an entry that was altered after it was written.`,
    ...linkBreakSentences(altered),
    ...trees.map((tree) => ALTERED_IN[tree].out(tailsOf(altered, tree))),
    'Switching a channel off is a write to the same record, so it is refused too.',
  ].join('\n\n');
}

/**
 * What `mnema doctor` says of a record that holds an entry altered after it was written, or
 * `undefined` where none does: in one line, the tree, the entry (in the words every surface says it
 * in) and the way out. The same facts the refusal of a write is made of, said before a write meets them.
 */
export function alteredEntryFinding(facts: readonly ScopedLinkBreak[]): string | undefined {
  const altered = facts.filter((fact) => fact.retained !== undefined);
  if (altered.length === 0) return undefined;
  const trees = [...new Set(altered.map((fact) => fact.scope))];
  return [
    `${trees.map((tree) => ALTERED_IN[tree].tree).join(' and ')} holds an entry that was altered after it was written.`,
    ...linkBreakSentences(altered),
    ...trees.map((tree) => ALTERED_IN[tree].out(tailsOf(altered, tree))),
  ]
    .join(' ')
    .replace(/\s*\n+\s*/g, ' ');
}

/**
 * The refusal a part of the record that was not read stands for, as the reader that met it would
 * have thrown it: a read serves around such a part, and a write is refused over it as it always was
 * (ADR-396), by the same error, so every door says it in the same words. `fact.unread` is set.
 */
export function unreadableErrorOf(fact: ScopedLinkBreak): UnreadableLineError {
  const { unread } = fact;
  if (unread === undefined)
    throw new Error('a fact that names no part of the record was asked for its refusal');
  if (unread.kind === 'link') return new LinkedRecordError({ root: unread.root }, unread.place);
  if (unread.kind === 'disk') {
    return new UnreadableDiskError(
      join(unread.root, ...unread.place.split('/')),
      unread.reason,
      unread.place,
      'UNREADABLE',
    );
  }
  const file = join(unread.root, ...unread.place.split('/'));
  return new UnreadableLineError(`${file} line ${unread.line ?? 0}`, unread.reason);
}

/**
 * Refuses the write when any of the facts is a part of the record this mnema does not read (the
 * error the reader would have thrown) or an altered entry: the one throw of both doors.
 */
export function refuseWhileAltered(facts: readonly ScopedLinkBreak[]): void {
  const unread = facts.find((fact) => fact.unread !== undefined);
  if (unread !== undefined) throw unreadableErrorOf(unread);
  const sentence = alteredEntrySentence(facts);
  if (sentence !== undefined) throw new AlteredEntryError(sentence);
}

/**
 * What a command line says when it met a stored line it cannot read: the line (file and position, so
 * the tail), what the unreadable tree closes, the ways out the refusal of a write names, and the
 * command that lists every such line. Every write is refused until the line reads, and so is
 * `switch off`: the switch is a fact of the same record.
 */
export function unreadableLineSentence(
  error: UnreadableLineError,
  trees: readonly Pick<ScopedCache, 'scope' | 'chainRoot'>[],
): string {
  const tree = treeOfTheLine(error.locus, trees) ?? 'unknown';
  if (error instanceof LinkedRecordError) {
    return [
      `Nothing was done: ${UNREADABLE_IN[tree].tree} holds a symbolic link, which this mnema does not follow.`,
      error.message,
      LINKED_WAY_OUT[tree],
      'Switching a channel off is a write to the same record, so it is refused too. `mnema verify` names every link it refuses.',
    ].join('\n\n');
  }
  if (error instanceof UnreadableDiskError) {
    return [
      `Nothing was done: ${treeOfThePart(error, tree)} holds a part the disk does not let this mnema open.`,
      saidWhere(error, tree),
      DISK_WAY_OUT_OF[tree],
      'Switching a channel off is a write to the same record, so it is refused too.',
    ].join('\n\n');
  }
  const words = UNREADABLE_IN[tree];
  return [
    `Nothing was done: ${words.tree} holds a line this mnema cannot read.`,
    error.message,
    words.out(tailsOfTheLocus(error.locus)),
    'Switching a channel off is a write to the same record, so it is refused too. `mnema verify` lists every unreadable line with its tail and position.',
  ].join('\n\n');
}

/**
 * The tree whose chain holds the file a locus names, among the trees the door resolved: the
 * DEEPEST chain root it lies under, because outside a repository the private tree's chain sits
 * inside the public one's.
 */
function treeOfTheLine(
  locus: string,
  trees: readonly Pick<ScopedCache, 'scope' | 'chainRoot'>[],
): Scope | undefined {
  const holding = trees
    .filter(({ chainRoot }) => locus.startsWith(`${chainRoot}${sep}`))
    .sort((a, b) => b.chainRoot.length - a.chainRoot.length);
  return holding[0]?.scope;
}

/**
 * Which record a part the disk will not open belongs to, when it is not under a tree's own folder: inside
 * a repository the public tree's locks and installation ids are in the git directory, and the
 * identity's keys are in the mnema home. A part under a tree is that tree's.
 */
function treeOfThePart(error: UnreadableDiskError, tree: Scope | 'unknown'): string {
  if (tree !== 'unknown') return UNREADABLE_IN[tree].tree;
  if (
    /[\\/]identity[\\/]keys(?:[\\/]|$)/.test(error.locus) ||
    error.locus.endsWith(`${sep}identity`)
  ) {
    return 'the identity’s keys folder in the mnema home';
  }
  if (/[\\/]mnema[\\/][^\\/]+[\\/]public[\\/]/.test(error.locus)) {
    return 'the project’s public record (its locks and installation ids are kept in the git directory)';
  }
  return UNREADABLE_IN.unknown.tree;
}

/** The part's place in the record, and, where it is outside every tree, where it is on the disk. */
function saidWhere(error: UnreadableDiskError, tree: Scope | 'unknown'): string {
  return tree === 'unknown' ? `${error.message}. It is at ${error.locus}.` : error.message;
}

/** What the refusal says of each tree: which it is, how far the refusal reaches, and the way out. */
const UNREADABLE_IN: Readonly<
  Record<Scope | 'unknown', { tree: string; out: (tails: readonly string[]) => string }>
> = {
  public: {
    tree: 'the project’s public record',
    // A line that is not in a segment (a checkpoint's) is not one the verb puts back.
    out: (tails) =>
      tails.length === 0
        ? 'Every write in the project is refused until the line reads: update mnema if a newer one wrote the line, or restore the line from the repository’s history.'
        : `Every write in the project is refused until the line reads: update mnema if a newer one wrote the line, or ${repairWords(tails)} puts it back from the repository’s history.`,
  },
  private: {
    tree: 'the project’s private record on this machine',
    out: () => `Every write in the project is refused until the line reads. ${NOT_VERSIONED}`,
  },
  global: {
    tree: 'this machine’s global record',
    out: () =>
      `This closes every project on this machine: every write in each is refused until the line reads. ${NOT_VERSIONED}`,
  },
  // Not reached by a door, which hands the trees it read; said rather than guessed if it is.
  unknown: {
    tree: 'the record',
    out: () =>
      'Every write that reads this record is refused until the line reads: update mnema if a newer one wrote the line, restore the line from the repository’s history or the file from a copy, or repair or remove the line named above.',
  },
};

/**
 * The way out of a refusal for a part the disk does not let this mnema open, by tree and by how far it
 * reaches. It names no verb that puts a line back: the part to be put right is a permission or a
 * folder, which no history holds (ADR-408 keeps `mnema tail repair` out of the private and the
 * global tree, and a line is all it puts back).
 */
const DISK_WAY_OUT_OF: Readonly<Record<Scope | 'unknown', string>> = {
  public: `Every write in the project is refused until the part opens: ${DISK_WAY_OUT}`,
  private: `Every write in the project is refused until the part opens: ${DISK_WAY_OUT} This record is not versioned.`,
  global: `This closes every project on this machine: every write in each is refused until the part opens. ${DISK_WAY_OUT} This record is not versioned.`,
  unknown: `Every write that reads this record is refused until the part opens: ${DISK_WAY_OUT}`,
};

/** The note on the second stream beside that refusal. */
export const UNREADABLE_RECORD_NOTE =
  'The record could not be read, so the write was refused and nothing was recorded.';

function verdict(
  sources: readonly ScopedCache[],
  grade: WriteVerdict['grade'],
  met: readonly { readonly at: RulesAtPath; readonly notice: string }[],
): WriteVerdict {
  const notices = met.map((one) => {
    const apart = movedApartLine(sources, one.at.rules);
    return apart === undefined ? one.notice : `${one.notice}\n${apart}`;
  });
  const newer = newerLinesOf(sources.map((source) => source.cache));
  const said = newer === undefined ? undefined : newerLinesSentence(newer);
  return {
    grade,
    at: met.map((one) => one.at),
    reason: (said === undefined ? notices : [...notices, said]).join('\n\n'),
    notices,
    ...(said === undefined ? {} : { newer: said }),
  };
}

/**
 * How long a charge's facts may take, in all, before the reply goes to the host without them: a
 * new try starts only if one more of the tail lock's own waits ({@link DEFAULT_WAIT_MS}, 2 s) would
 * end inside it. So the command hook tries three times, at about 0, 2 and 4 s, and gives up at 6.
 *
 * THE RULE REFUSES WHETHER OR NOT ITS FACT LANDS. The refusal and the asking are decided by
 * reading the record, which takes no lock; only the fact that a write was refused or held is an
 * append. This used to fall the other way (a fact that could not be written refused nobody) and
 * that made any live process holding the tail a way around every rule of the project for as long
 * as it held it: measured, the write went through at 2.3 s with the lock held by a live pid. So
 * the fact gets more patience than an ordinary write, and its absence is said in the reason.
 *
 * A BUDGET IN TIME, NOT A COUNT OF TRIES. The first try in the server can take two waits (it
 * opens the session's run, then appends the facts, each under a hold of its own), so a count of
 * three let one call wait 8 s and more. No later try opens the run again, so no try can end past
 * this budget: 7 s is the worst, however the waits fall. Measured on the binary with the tail held
 * by a live pid: the command hook answered `deny` in 6.3 s, the server's refusal and asking in
 * 6.0 s each (they were 8.1 s for the asking before the service fact stopped being tried after a
 * charge that did not land).
 *
 * It stays well under the hook's timeout because a host that times the hook out lets the write
 * through: every host this plugin wires gives the hook 15 s (`plugin/hooks/hooks.json`), and a
 * hook that waited as long as it takes would reopen the write by that road.
 */
export const A_CHARGE_WAITS_MS = 7_000;

/** Whether a charge's facts are on the chain, and if not, why: in words the reason can carry. */
export type ChargeRecorded = { readonly ok: true } | { readonly ok: false; readonly why: string };

/**
 * Appends a charge's facts with up to {@link A_CHARGE_WAITS_MS} of patience, and never throws: the
 * reply to the host is composed whatever this answers.
 */
export function recordTheCharge(
  record: () => { readonly ok: boolean; readonly why?: string },
): ChargeRecorded {
  const started = Date.now();
  for (;;) {
    try {
      const done = record();
      if (done.ok) return { ok: true };
      return { ok: false, why: done.why ?? 'the record would not take the fact' };
    } catch (error) {
      const endsInside = Date.now() - started + DEFAULT_WAIT_MS <= A_CHARGE_WAITS_MS;
      if (error instanceof TailBusyError && endsInside) continue;
      return { ok: false, why: whyNotRecorded(error) };
    }
  }
}

function whyNotRecorded(error: unknown): string {
  if (error instanceof TailBusyError) {
    const holder = error.heldBy === undefined ? 'another process' : `process ${error.heldBy}`;
    return `${holder} was writing the record for longer than this could wait (lock: ${oneLine(error.tailLock)})`;
  }
  return oneLine(error instanceof Error ? error.message : String(error));
}

/** The sentence a reason carries when the charge it states could not be recorded. */
export function unrecordedCharge(grade: WriteVerdict['grade'], why: string): string {
  const what = grade === 'refuse' ? 'This refusal' : 'This request for a person';
  return `${what} could not be recorded in the project's record, so the record does not show it: ${why.replace(/\.+$/, '')}.`;
}

/** What a write at a path would meet: the gate's grade, or `governs`, or `none`. */
export type VerdictAtAPath = WriteVerdict['grade'] | 'governs' | 'none';

/**
 * The verdict a write at `read.path` would meet, for a reader that TELLS (`mnema why`, and any
 * reader that must say what the gate would say): what the gate answers, in the gate's own order.
 * First a record with an altered or unreadable line ({@link refusalOfAnAlteredRecord}, over `facts`,
 * the link breaks of the project's own trees): the write is refused whatever the rules say, with that
 * reason. Then {@link whatAWriteMeets}, the function every door asks. Only when both answer nothing,
 * `governs` when a governing rule is in force there and `none` when none is.
 *
 * Each rule of `rules` is marked `decided` when it is one the verdict stands on: a rule the gate named
 * under its grade, or, under `governs`, a governing rule. A rule outranked by another relation, whose
 * channel is switched off, or beside a refusal of the record, is not.
 */
export function verdictAtAPath(
  sources: readonly ScopedCache[],
  read: GovernedRead,
  rules: readonly RuleInForceUnder[],
  facts: readonly ScopedLinkBreak[] = [],
): {
  readonly verdict: VerdictAtAPath;
  readonly decided: (rule: RuleInForceUnder) => boolean;
  /** The reason the gate hands over, when the record itself refuses the write. */
  readonly refusal?: string;
} {
  const refusal = refusalOfAnAlteredRecord(facts);
  if (refusal !== undefined) return { verdict: 'refuse', decided: () => false, refusal };
  const met = whatAWriteMeets(sources, { paths: [read.path], root: read.root, from: read.from });
  const verdict: VerdictAtAPath =
    met?.grade ?? (rules.some((rule) => rule.relation === GOVERNS_RELATION) ? 'governs' : 'none');
  const relation = {
    refuse: REFUSES_A_WRITE_RELATION,
    ask: ASKS_FOR_A_PERSON_RELATION,
    governs: GOVERNS_RELATION,
    none: undefined,
  }[verdict];
  const named = new Set(met?.at.flatMap((at) => at.rules.map((rule) => rule.id)));
  return {
    verdict,
    decided: (rule) => rule.relation === relation && (met === undefined || named.has(rule.id)),
  };
}
