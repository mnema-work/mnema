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
 * "QUOTES THE PERSON" is the same definition as the accept gate's: a passage between double
 * quotes of at least 20 characters that is not pure assent. The reading judges by the form of
 * the note alone and cannot see the conversation, so a note that cites the person falsely
 * passes; the gate checks the passage at accept time, this reading does not.
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

/**
 * The shortest quoted passage that counts as the person's words, after folding. The accept
 * gate asks the same of a note; this reading keeps its own copy of the predicate so that it
 * can be switched to the gate's helper once that lands.
 */
const LEAST_QUOTED = 20;
const QUOTED = /"([^"]+)"|\u201c([^\u201d]+)\u201d|\u00ab([^\u00bb]+)\u00bb/g;
/** The words a passage of pure assent is made of ("yes", "sim, pode", "ok", "go ahead"). */
const ASSENT = new Set([
  'yes',
  'yep',
  'yeah',
  'sure',
  'ok',
  'okay',
  'go',
  'ahead',
  'please',
  'do',
  'it',
  'that',
  'is',
  'fine',
  'right',
  'agreed',
  'approved',
  'accept',
  'accepted',
  'sim',
  'pode',
  'claro',
  'certo',
  'isso',
  'mesmo',
  'exato',
  'aceito',
  'aceita',
  'aprovado',
  'concordo',
  'bora',
  'vai',
  'fazer',
  'faca',
  'faz',
  'por',
  'favor',
  'tudo',
  'bem',
  'beleza',
  'otimo',
  'perfeito',
  'combinado',
  'ta',
  'esta',
  'e',
  'o',
  'a',
]);

/** Text folded to compare: NFC, lower case, the curly apostrophe straight, spaces collapsed. */
function folded(text: string): string {
  return text.normalize('NFC').toLowerCase().replaceAll('\u2019', "'").replace(/\s+/g, ' ').trim();
}

/** Whether a folded passage is nothing but assent, accents and punctuation set aside. */
function pureAssent(passage: string): boolean {
  const words = passage
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .split(/[^\p{L}\p{N}']+/u)
    .filter((w) => w !== '');
  return words.every((w) => ASSENT.has(w));
}

/**
 * Whether an acceptance note rests on the person, judged by the note's form only: a passage
 * between double quotes (straight, curly or Portuguese), of at least 20 characters once
 * folded, that is not pure assent. The passage is not checked against the conversation here
 * (the reading cannot see the transcript); the accept gate checks it at accept time. Single
 * quotes, "chosen by" and "the maintainer said" do not count.
 */
export function restsOnThePerson(note: string): boolean {
  for (const match of note.matchAll(QUOTED)) {
    const passage = folded(match[1] ?? match[2] ?? match[3] ?? '');
    if (passage.length >= LEAST_QUOTED && !pureAssent(passage)) return true;
  }
  return false;
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
