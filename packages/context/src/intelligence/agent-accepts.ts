/**
 * What agents accepted, read three ways (ADR-614): a reading, never a pause.
 *
 * `agent-accepts` can be switched off by a person, and that is the only brake there is. What
 * was missing is the sign that says when to reach for it, and it is three facts of the record
 * that anyone can recompute offline:
 *
 *  1. the rules a PERSON accepted (an accept whose envelope declares no agent), or that carry
 *     an ADDRESS, which an AGENT then took out of force (a supersede that declares one);
 *  2. the chains of supersedes of three decisions or more (A to B to C);
 *  3. the accepts that declare an agent and quote no words of the person.
 *
 * WHO ACCEPTED IS THE ENVELOPE'S `which` and nothing else. An event with none is "no agent
 * declared", which is not the same as "a person": the record cannot tell a person at a
 * terminal from an agent that ran the command without `--which`, and neither signal below
 * says more than that. Nothing here is a verdict on a decision, nothing is written, and no
 * clock is read: the order is the record's.
 *
 * "QUOTES THE PERSON" is what ADR-611 says counts as resting on the person's words: words they
 * typed, quoted, or an option they chose in a question (the note then says "chosen by" or
 * "dictated by"). It is read from the words of the note, so a note that cites the person
 * falsely passes; the reading says what the note says and cannot say that it is true.
 *
 * There is no threshold: the numbers are the reading, and the person decides.
 */

import { ADDRESS_RELATIONS } from '@mnema/core';
import type { CatalogEvent } from './events.js';

/** A rule accepted with no agent declared, or an addressed one, that an agent superseded. */
export interface PersonRuleSuperseded {
  /** The decision taken out of force. */
  readonly decision: string;
  /** The successor the supersede names. */
  readonly by: string;
  /** The agent the supersede declares. */
  readonly which: string;
  /** The `at` the supersede claims. */
  readonly at: string;
  /** Why it is on the list: the accept declared no agent (not proof of a person), or the rule carries an address. */
  readonly because: 'accepted-with-no-agent-declared' | 'addressed';
}

/** An accept that declares an agent and quotes no words of the person. */
export interface AcceptWithoutTheirWords {
  readonly decision: string;
  readonly which: string;
  readonly at: string;
}

/** The three readings, and the count the third is a share of. */
export interface AgentAcceptsReading {
  readonly rulesSupersededByAgent: readonly PersonRuleSuperseded[];
  /** Each chain as the decision ids, oldest first: three or more. */
  readonly chains: readonly (readonly string[])[];
  /** How many accepts declare an agent. */
  readonly agentAccepts: number;
  readonly acceptsWithoutTheirWords: readonly AcceptWithoutTheirWords[];
  /** How many accepts declare no agent: not read as a person's. */
  readonly undeclaredAccepts: number;
  /** Those among them whose note quotes no words of the person, apart from the list above. */
  readonly undeclaredWithoutTheirWords: readonly {
    readonly decision: string;
    readonly at: string;
  }[];
}

const DOUBLE_OPEN = '"“«';
const DOUBLE_CLOSE = '"”»';
const SINGLE_OPEN = "'‘";
const SINGLE_CLOSE = "'’";
const WORD_CHAR = /[\p{L}\p{N}]/u;
const CHOSEN_OR_DICTATED = /\b(?:chosen|dictated) by\b|\bas dictated\b/i;
const MAINTAINER = /\bmaintainer\b/i;
const DID_IT = /\b(?:chose|chosen|said|kept|dictated)\b/i;

/**
 * Whether a pair of the given quote marks encloses words. Read by walking the marks once,
 * never by a pattern with two open-ended runs around the words, which backtracks
 * quadratically on a long note with many marks. A single quote opens at the start of a
 * word and closes at its end, so the apostrophe of "don't" or "users'" is not a pair.
 */
function quotes(note: string, open: string, close: string, atWordEdges: boolean): boolean {
  const marks: number[] = [];
  for (let i = 0; i < note.length; i += 1) {
    if (open.includes(note.charAt(i)) || close.includes(note.charAt(i))) marks.push(i);
  }
  for (let k = 0; k + 1 < marks.length; k += 1) {
    const from = marks[k] as number;
    const to = marks[k + 1] as number;
    if (!open.includes(note.charAt(from)) || !close.includes(note.charAt(to))) continue;
    if (atWordEdges) {
      if (from > 0 && WORD_CHAR.test(note.charAt(from - 1))) continue;
      if (to + 1 < note.length && WORD_CHAR.test(note.charAt(to + 1))) continue;
    }
    if (note.slice(from + 1, to).trim() !== '') return true;
  }
  return false;
}

/** A sentence in which the maintainer chose, said, kept or dictated it. */
function maintainerDidIt(note: string): boolean {
  return note.split(/[.\n]/).some((sentence) => MAINTAINER.test(sentence) && DID_IT.test(sentence));
}

/**
 * Whether an acceptance note quotes the person: a quoted span with words in it, or the
 * words "chosen by" or "dictated by" (an option the person picked), "as dictated", or a
 * sentence in which the maintainer chose, said, kept or dictated it.
 */
export function restsOnThePerson(note: string): boolean {
  return (
    quotes(note, DOUBLE_OPEN, DOUBLE_CLOSE, false) ||
    quotes(note, SINGLE_OPEN, SINGLE_CLOSE, true) ||
    CHOSEN_OR_DICTATED.test(note) ||
    maintainerDidIt(note)
  );
}

/** Reads the three signals over the record's events, in the order handed in. */
export function agentAcceptsReading(events: readonly CatalogEvent[]): AgentAcceptsReading {
  const acceptedWithNoAgent = new Set<string>();
  const addressed = new Set<string>();
  const superseded: PersonRuleSuperseded[] = [];
  const next = new Map<string, string>();
  const unquoted: AcceptWithoutTheirWords[] = [];
  let agentAccepts = 0;
  let undeclaredAccepts = 0;
  const undeclared: { decision: string; at: string }[] = [];
  const retracted = (e: CatalogEvent): string | undefined =>
    e.kind === 'link.retracted'
      ? `${e.subject}\u0000${e.payload.rel}\u0000${e.payload.target}`
      : undefined;
  const gone = new Set(events.map(retracted).filter((k): k is string => k !== undefined));

  for (const e of events) {
    if (e.kind === 'knowledge.linked') {
      const key = `${e.subject}\u0000${e.payload.rel}\u0000${e.payload.target}`;
      if ((ADDRESS_RELATIONS as readonly string[]).includes(e.payload.rel) && !gone.has(key)) {
        addressed.add(e.subject);
      }
      continue;
    }
    if (e.kind !== 'decision.transitioned') continue;
    const move = e.payload;
    const note = move.fields?.note;
    if (move.action === 'accept') {
      if (e.which === undefined) {
        acceptedWithNoAgent.add(e.subject);
        undeclaredAccepts += 1;
        if (!restsOnThePerson(note ?? '')) undeclared.push({ decision: e.subject, at: e.at });
        continue;
      }
      agentAccepts += 1;
      if (!restsOnThePerson(note ?? '')) {
        unquoted.push({ decision: e.subject, which: e.which, at: e.at });
      }
      continue;
    }
    if (move.action !== 'supersede' || move.by === undefined) continue;
    if (!next.has(e.subject)) next.set(e.subject, move.by);
    if (move.from !== 'accepted' || e.which === undefined) continue;
    const because = acceptedWithNoAgent.has(e.subject)
      ? 'accepted-with-no-agent-declared'
      : addressed.has(e.subject)
        ? 'addressed'
        : undefined;
    if (because !== undefined) {
      superseded.push({ decision: e.subject, by: move.by, which: e.which, at: e.at, because });
    }
  }
  return {
    rulesSupersededByAgent: superseded,
    chains: chainsOf(next),
    agentAccepts,
    acceptsWithoutTheirWords: unquoted,
    undeclaredAccepts,
    undeclaredWithoutTheirWords: undeclared,
  };
}

/** Every chain of three decisions or more, from each decision nothing superseded into. */
function chainsOf(next: ReadonlyMap<string, string>): string[][] {
  const replaced = new Set(next.values());
  const out: string[][] = [];
  for (const start of next.keys()) {
    if (replaced.has(start)) continue;
    const chain = [start];
    for (let at = next.get(start); at !== undefined && !chain.includes(at); at = next.get(at)) {
      chain.push(at);
    }
    if (chain.length >= 3) out.push(chain);
  }
  return out;
}
