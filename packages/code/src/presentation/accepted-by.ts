/**
 * How a rule says WHO ACCEPTED IT: written once, for every place that tells a rule.
 *
 * The opening document, the rules a push hands over at an edit and the answer to `governing_rules`
 * all carry the same reading of the same fact (`Acceptance`, `@mnema/context`), and the words for
 * it live here so they cannot come to differ: `accepted by mnid:ab12cd34 (a person)`, or
 * `(agent claude-code)`, and `; unconfirmed` where the record has somebody who could have
 * confirmed it and nobody did. Every value goes through {@link oneLine}: the identity and the agent
 * name are the record's, and a break in either would start a line that reads as a rule.
 */

import type { Acceptance } from '@mnema/context';
import { A_PERSON, NO_NAME_ANNOUNCED, oneLine } from '../one-line.js';

/** `accepted by mnid:ab12cd34 (a person)`, `(agent claude-code; unconfirmed)`. */
export function acceptedBy(acceptance: Acceptance): string {
  const act =
    acceptance.agent === undefined
      ? A_PERSON
      : `agent ${oneLine(acceptance.agent)}${acceptance.unannounced === true ? `, ${NO_NAME_ANNOUNCED}` : ''}`;
  const mark = acceptance.unconfirmed ? '; unconfirmed' : '';
  return `accepted by ${oneLine(acceptance.by)} (${act}${mark})`;
}

/**
 * The identity that accepted most of `rules`: the one the opening text names once in its header,
 * so the lines can leave it out. Undefined when no rule has an acceptance. A tie goes to the
 * identity that comes first in the list, which is the most recently settled.
 */
export function usualIdentity(
  rules: readonly { readonly acceptance?: Acceptance }[],
): string | undefined {
  const counts = new Map<string, number>();
  for (const one of rules) {
    if (one.acceptance === undefined) continue;
    counts.set(one.acceptance.by, (counts.get(one.acceptance.by) ?? 0) + 1);
  }
  let best: string | undefined;
  let most = 0;
  for (const [by, n] of counts) {
    if (n > most) {
      best = by;
      most = n;
    }
  }
  return best;
}

/**
 * The tail of a rule line in the opening text: `2026-11-19 · agent`, or `2026-11-19 · person`.
 * The identity is said only when it is not `usual` (the one the header names), and then with its
 * unconfirmed mark; an agent whose name nobody announced says so, as {@link acceptedBy} does.
 */
export function acceptedOnLine(acceptance: Acceptance, usual: string | undefined): string {
  const role =
    acceptance.agent === undefined
      ? 'person'
      : acceptance.unannounced === true
        ? `agent, ${NO_NAME_ANNOUNCED}`
        : 'agent';
  const other =
    acceptance.by === usual
      ? []
      : [`${oneLine(acceptance.by)}${acceptance.unconfirmed ? ' (unconfirmed)' : ''}`];
  return [...(acceptance.day === undefined ? [] : [acceptance.day]), role, ...other].join(' · ');
}
