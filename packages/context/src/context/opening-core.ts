/**
 * Which decisions in force rest on the person's own words: the fixed core of an opening text that
 * pulls what the work needs (ADR-609, ADR-610).
 *
 * THE MEMBERSHIP IS READ FROM THE ACCEPTANCE NOTE, not from who typed the accept. A person's key
 * mostly accepted unexplained clicks, while what the person dictated was accepted by an agent with
 * a note quoting them: the note is what marks a rule as theirs, and it is already recorded, so
 * nothing new is written. It says what the note says and cannot say that it is true: a note that
 * cites the person falsely passes, as in {@link noteQuotesThePerson}.
 *
 * ONE FACT OF THE RECORD AND NO CLOCK: the answer is a set of decision ids, a function of the
 * events alone, so two machines holding the same record read the same core.
 */

import type { ScopedCache } from '../sources.js';

const DOUBLE_OPEN = '"“«';
const DOUBLE_CLOSE = '"”»';
const SINGLE_OPEN = "'‘";
const SINGLE_CLOSE = "'’";
const WORD_CHAR = /[\p{L}\p{N}]/u;
const CHOSEN_OR_DICTATED = /\b(?:chosen|dictated) by\b|\bas dictated\b/i;
const MAINTAINER = /\bmaintainer\b/i;
const DID_IT = /\b(?:chose|chosen|said|kept|dictated)\b/i;

/**
 * Whether a pair of the given quote marks encloses words. Read by walking the marks once, never
 * by a pattern with two open-ended runs around the words, which backtracks quadratically on a
 * long note with many marks. A single quote opens at the start of a word and closes at its end,
 * so the apostrophe of "don't" or "users'" is not a pair.
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
 * Whether an acceptance note quotes the person: a quoted span with words in it (straight, curly,
 * single or Portuguese quotes), the words "chosen by" or "dictated by", "as dictated", or a
 * sentence in which the maintainer chose, said, kept or dictated it.
 *
 * THIS MIRRORS `restsOnThePerson` of the antipatterns reading (PR 1386, ADR-625) rule for rule,
 * because that pull request is not in the trunk yet and this one does not stack on it. The two
 * are held to one table of cases (`opening-core.test.ts` repeats its rows); when that one lands,
 * this function becomes a call to it.
 */
export function noteQuotesThePerson(note: string): boolean {
  return (
    quotes(note, DOUBLE_OPEN, DOUBLE_CLOSE, false) ||
    quotes(note, SINGLE_OPEN, SINGLE_CLOSE, true) ||
    CHOSEN_OR_DICTATED.test(note) ||
    maintainerDidIt(note)
  );
}

/**
 * The ids, among `ids`, of the decisions whose LAST accept in the tree that travels (the committed
 * one, the only tree an opening's fixed core is read from) carries a note that quotes the person.
 * A decision with no accept there, or an accept with no note, is not in it.
 */
export function decisionsOnThePersonsWords(
  sources: readonly ScopedCache[],
  ids: readonly string[],
): ReadonlySet<string> {
  const core = new Set<string>();
  const caches = sources.filter((source) => source.scope === 'public').map((s) => s.cache);
  for (const id of ids) {
    for (const cache of caches) {
      const accepting = cache
        .references(id)
        .filter(
          (row) =>
            row.role === 'subject' &&
            row.event.kind === 'decision.transitioned' &&
            row.event.payload.to === 'accepted',
        )
        .at(-1);
      if (accepting === undefined || accepting.event.kind !== 'decision.transitioned') continue;
      if (noteQuotesThePerson(accepting.event.payload.fields?.note ?? '')) core.add(id);
      break;
    }
  }
  return core;
}
