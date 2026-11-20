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

/** A rule a person accepted, or an addressed one, that an agent superseded. */
export interface PersonRuleSuperseded {
  /** The decision taken out of force. */
  readonly decision: string;
  /** The successor the supersede names. */
  readonly by: string;
  /** The agent the supersede declares. */
  readonly which: string;
  /** The `at` the supersede claims. */
  readonly at: string;
  /** Why it is on the list: the accept declared no agent, or the rule carries an address. */
  readonly because: 'accepted-by-a-person' | 'addressed';
}

/** An accept that declares an agent and quotes no words of the person. */
export interface AcceptWithoutTheirWords {
  readonly decision: string;
  readonly which: string;
  readonly at: string;
}

/** The three readings, and the count the third is a share of. */
export interface AgentAcceptsReading {
  readonly personRulesSupersededByAgent: readonly PersonRuleSuperseded[];
  /** Each chain as the decision ids, oldest first: three or more. */
  readonly chains: readonly (readonly string[])[];
  /** How many accepts declare an agent. */
  readonly agentAccepts: number;
  readonly acceptsWithoutTheirWords: readonly AcceptWithoutTheirWords[];
}

const QUOTED = /["“«][^"“”«»]*\S[^"“”«»]*["”»]/;
const CHOSEN_OR_DICTATED = /\b(?:chosen|dictated) by\b/i;

/**
 * Whether an acceptance note quotes the person: a quoted span with words in it, or the
 * words "chosen by" or "dictated by" (an option the person picked).
 */
export function restsOnThePerson(note: string): boolean {
  return QUOTED.test(note) || CHOSEN_OR_DICTATED.test(note);
}

/** Reads the three signals over the record's events, in the order handed in. */
export function agentAcceptsReading(events: readonly CatalogEvent[]): AgentAcceptsReading {
  const acceptedByPerson = new Set<string>();
  const addressed = new Set<string>();
  const superseded: PersonRuleSuperseded[] = [];
  const next = new Map<string, string>();
  const unquoted: AcceptWithoutTheirWords[] = [];
  let agentAccepts = 0;
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
        acceptedByPerson.add(e.subject);
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
    const because = acceptedByPerson.has(e.subject)
      ? 'accepted-by-a-person'
      : addressed.has(e.subject)
        ? 'addressed'
        : undefined;
    if (because !== undefined) {
      superseded.push({ decision: e.subject, by: move.by, which: e.which, at: e.at, because });
    }
  }
  return {
    personRulesSupersededByAgent: superseded,
    chains: chainsOf(next),
    agentAccepts,
    acceptsWithoutTheirWords: unquoted,
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
