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
 * Portuguese ones, {@link LEAST_QUOTED} characters or more, case and spacing folded) are looked for
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

/** The shortest passage that counts as words: a quoted word or a name is not a rule's source. */
export const LEAST_QUOTED = 6;

/** The most a transcript may weigh to be read at an accept: a larger one is not known, and said so. */
const MOST_BYTES = 256 * 1024 * 1024;

const QUOTED = /"([^"]+)"|“([^”]+)”|«([^»]+)»/g;

/** Text folded to compare: Unicode NFC, lower case, every run of space one space. */
function folded(text: string): string {
  return text.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** The passages a note puts between quotation marks that are long enough to be words, folded. */
export function quotedPassages(note: string): readonly string[] {
  const passages: string[] = [];
  for (const match of note.matchAll(QUOTED)) {
    const passage = folded(match[1] ?? match[2] ?? match[3] ?? '');
    if (passage.length >= LEAST_QUOTED) passages.push(passage);
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
      '(a passage between double quotes of 6 characters or more, exactly as typed) and no option ' +
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
