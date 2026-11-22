/**
 * Which decisions in force the person DICTATED: the fixed core of an opening text that pulls what
 * the work needs (ADR-650, which supersedes ADR-609; ADR-610).
 *
 * THE MEMBERSHIP IS READ FROM THE ACCEPTANCE NOTE, not from who typed the accept. What the person
 * dictated was mostly accepted by an agent with a note that says so ("Dictated by the
 * maintainer ...", "Accepted as dictated"), while a rule the person only chose among options the
 * agent offered carries "Chosen by ..." and is not in the core. The note is already recorded, so
 * nothing new is written. It says what the note says and cannot say that it is true: a note that
 * claims the person dictated a rule falsely passes. An explicit pin by the person, to mark other
 * rules, is a later step and is not read here.
 *
 * ONE FACT OF THE RECORD AND NO CLOCK: the answer is a set of decision ids, a function of the
 * events alone, so two machines holding the same record read the same core.
 */

import type { ScopedCache } from '../sources.js';

const DICTATED =
  /\b(?:dictated by|as dictated)\b|\b(?:maintainer|person|user) (?:had |has )?dictated\b/gi;
const NEGATION_BEFORE = /\b(?:not|nothing|never|no)\W+(?:\w+\W+){0,3}$/i;
const BY_AN_AGENT = /^\W*(?:the |an? )?agent\b/i;

/**
 * Whether an acceptance note says the person dictated the rule: "dictated by", "as dictated", or
 * the maintainer, the person or the user having dictated it. A note that only quotes the person,
 * or says they chose, said or kept it, does not; nor one that negates it ("not dictated by",
 * "nothing was dictated") or says an agent dictated it.
 */
export function noteSaysTheyDictatedIt(note: string): boolean {
  for (const hit of note.matchAll(DICTATED)) {
    const before = note.slice(Math.max(0, hit.index - 40), hit.index);
    if (NEGATION_BEFORE.test(before)) continue;
    if (BY_AN_AGENT.test(note.slice(hit.index + hit[0].length, hit.index + hit[0].length + 20))) {
      continue;
    }
    return true;
  }
  return false;
}

/**
 * The ids, among `ids`, of the decisions whose LAST accept in the tree that travels (the committed
 * one, the only tree an opening's fixed core is read from) carries a note that says the person
 * dictated the rule. A decision with no accept there, or an accept with no note, is not in it.
 */
export function decisionsTheyDictated(
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
      if (noteSaysTheyDictatedIt(accepting.event.payload.fields?.note ?? '')) core.add(id);
      break;
    }
  }
  return core;
}
