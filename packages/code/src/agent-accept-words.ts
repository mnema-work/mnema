/**
 * An agent's acceptance rests on the person's words, or it waits for the person.
 *
 * THE RULE (the decision of the person who owns the product): an agent's `accept` stands when its
 * note quotes words the person typed in this session, or an option the person chose in the host's
 * question tool; any other acceptance waits for the person (`mnema decision review`). It is the
 * counterpart of `agent-accepts.ts`, which asks whether agents may accept at all, and it is asked
 * at the same two doors (the MCP tool and the command line with `--which`), once per accept, after
 * that switch and before anything is written, so a refusal leaves the record as it found it.
 *
 * WHAT IS CHECKED. The passages the note puts between double quotes (straight, curly or
 * Portuguese ones, {@link LEAST_QUOTED} characters or more once folded, and not pure assent) are looked for
 * in what the person said, read off the host's own transcript by `whatThePersonSaid`: a line the
 * host marks as typed by a person, and the answer given in its question tool. One passage found
 * is enough; the reply says which of the two it was found in. Nothing is written: not the passage, not
 * the line it was found on, and the record's format does not change.
 *
 * WHAT IT CANNOT PROVE, said as such: that the words were in the transcript, not that a person typed
 * them (an agent with a shell can write the transcript), and a note may quote words that sit in the
 * transcript and say something else about them. An option's label is the agent's own text, which
 * the person chose: the reply says "chose", never "said". The words are not required to follow the
 * decision's record, so a sentence typed earlier in the same session still counts.
 *
 * WHERE IT APPLIES. Only where the session's transcript is known: the host's session (Claude
 * Code's `CLAUDE_CODE_SESSION_ID`) and the path its hooks left beside the session journal
 * (`session-journal.ts`). Every other host, a session no hook has told the path of, and an accept
 * made by a person, keep what they had, and the reply says the words were not checked. A transcript
 * that is known and holds no line of the person's (or cannot be read) is one that quotes nothing:
 * the accept waits.
 */

import { statSync } from 'node:fs';
import { type WhatThePersonSaid, whatThePersonSaid } from './what-the-session-did.js';

/** The code a refused accept carries. */
export const ACCEPT_NEEDS_THE_PERSONS_WORDS = 'ACCEPT_NEEDS_THE_PERSONS_WORDS';

/**
 * The shortest passage that counts as words: one that carries content ties the accept to what the
 * person said or chose, where a fragment such as "please" fits any accept. A short option label is
 * therefore not enough on its own: the person's own words are.
 */
export const LEAST_QUOTED = 20;

/**
 * The words of assent, a small closed list: a passage whose every word is one of these (or
 * punctuation) says yes to something and not what to, so it counts for no accept.
 */
const ASSENT = new Set([
  'yes',
  'yeah',
  'yep',
  'ok',
  'okay',
  'sure',
  'fine',
  'good',
  'great',
  'sounds',
  'lets',
  'go',
  'ahead',
  'on',
  'do',
  'it',
  'please',
  'proceed',
  'approved',
  'agreed',
  'right',
  'correct',
  'that',
  'this',
  'sim',
  'pode',
  'ir',
  'em',
  'frente',
  'manda',
  'segue',
  'vamos',
  'fechado',
  'de',
  'acordo',
  'beleza',
  'certo',
  'isso',
  'faca',
  'faz',
  'por',
  'favor',
  'claro',
  'perfeito',
  'otimo',
  'bora',
  'vai',
  'esse',
  'essa',
]);

/** A word of a passage: letters only, accents folded, so "let's" is "lets" and "faça" is "faca". */
function wordsOf(passage: string): string[] {
  return passage
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/['\u2019]/g, '')
    .split(/[^\p{L}]+/u)
    .filter((word) => word !== '');
}

/** Whether a folded passage is pure assent: it has words, and each of them is a word of assent. */
export function isPureAssent(passage: string): boolean {
  const words = wordsOf(passage);
  return words.length > 0 && words.every((word) => ASSENT.has(word));
}

/** The most a transcript may weigh to be read at an accept: a larger one is not known, and said so. */
const MOST_BYTES = 256 * 1024 * 1024;

const QUOTED = /"([^"]+)"|“([^”]+)”|«([^»]+)»/g;

/** Text folded to compare: Unicode NFC, lower case, the curly apostrophe straight, every run of space one space. */
function folded(text: string): string {
  return text.normalize('NFC').toLowerCase().replaceAll('\u2019', "'").replace(/\s+/g, ' ').trim();
}

/** The passages a note puts between quotation marks that are long enough to be words and not mere assent, folded. */
export function quotedPassages(note: string): readonly string[] {
  const passages: string[] = [];
  for (const match of note.matchAll(QUOTED)) {
    const passage = folded(match[1] ?? match[2] ?? match[3] ?? '');
    if (passage.length >= LEAST_QUOTED && !isPureAssent(passage)) passages.push(passage);
  }
  return passages;
}

/** What an accept rests on, or why it does not. */
export type WhatTheAcceptRestsOn =
  | { readonly outcome: 'typed' | 'chosen' }
  | { readonly outcome: 'not-checked'; readonly why: string }
  | { readonly outcome: 'waits'; readonly code: string; readonly message: string };

/** The accept being asked about and where the words may be looked for. */
export interface AcceptToCheck {
  readonly action: string;
  /** The agent the act declares: no agent declared is a person's accept, which is not checked. */
  readonly agent: string | undefined;
  readonly note: string | undefined;
  /** The host's session id when the door knows it, and the transcript path left for that session. */
  readonly hostSession: string | undefined;
  readonly transcript: string | undefined;
  /**
   * Set by the command line: an agent that declares Claude Code with no session id has left the one
   * thing the check reads by, so its accept waits (and does not pass as "not checked").
   */
  readonly refuseWithoutASession?: boolean;
}

/** What `whatThePersonSaid` is asked at: swapped by a test only. */
type ReadsWhatTheyEntered = (path: string) => readonly WhatThePersonSaid[];

/**
 * Whether this accept rests on the person's words. `undefined` when it is not the kind of act asked
 * about (not an accept, or no agent declared).
 */
export function whatTheAcceptRestsOn(
  move: AcceptToCheck,
  read: ReadsWhatTheyEntered = whatThePersonSaid,
): WhatTheAcceptRestsOn | undefined {
  if (move.action !== 'accept' || move.agent === undefined) return undefined;
  if (move.hostSession === undefined) {
    if (move.refuseWithoutASession === true && move.agent === 'claude-code') {
      return {
        outcome: 'waits',
        code: ACCEPT_NEEDS_THE_PERSONS_WORDS,
        message:
          'this accept declares claude-code and the session id Claude Code gives (`CLAUDE_CODE_SESSION_ID`) is not set, ' +
          'so the words it rests on cannot be looked for: a person accepts it (`mnema decision review`). ' +
          'The decision stays proposed and was not moved.',
      };
    }
    return { outcome: 'not-checked', why: 'this host does not hand its session to mnema' };
  }
  if (move.transcript === undefined) {
    return {
      outcome: 'not-checked',
      why: 'this session’s transcript is not known to mnema (its hooks have not run here)',
    };
  }
  let said: readonly WhatThePersonSaid[];
  try {
    if (statSync(move.transcript).size > MOST_BYTES) {
      return { outcome: 'not-checked', why: 'this session’s transcript is too large to read here' };
    }
    said = read(move.transcript);
  } catch {
    said = [];
  }
  const passages = quotedPassages(move.note ?? '');
  const found = said.flatMap((one) => {
    const text = folded(one.text);
    return passages.some((passage) => text.includes(passage))
      ? [one.from === 'answer' ? ('chosen' as const) : ('typed' as const)]
      : [];
  });
  // Words the person typed outweigh an option they chose, which the agent had written.
  if (found.includes('typed')) return { outcome: 'typed' };
  if (found.includes('chosen')) return { outcome: 'chosen' };
  return {
    outcome: 'waits',
    code: ACCEPT_NEEDS_THE_PERSONS_WORDS,
    message:
      'this accept is from an agent and its note quotes no words the person typed in this session ' +
      '(a passage between double quotes of 20 characters or more that says more than yes, exactly as typed) and no option ' +
      'the person chose in a question: a person accepts it (`mnema decision review`), or the ' +
      'agent accepts again with a note that quotes what the person said. The decision stays ' +
      'proposed and was not moved.',
  };
}

/** The line a reply carries about what an accept rested on. */
export function saysWhatTheAcceptRestedOn(rested: WhatTheAcceptRestsOn): string | undefined {
  switch (rested.outcome) {
    case 'typed':
      return 'The note quotes words the person typed in this session: the quotation was found in the transcript.';
    case 'chosen':
      return 'The note quotes an option the person chose in a question in this session: the option’s text is the agent’s, the choice is the person’s.';
    case 'not-checked':
      return `The words the note quotes were not checked against what the person said: ${rested.why}.`;
    case 'waits':
      return undefined;
  }
}
