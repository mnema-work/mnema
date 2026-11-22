/**
 * What `mnema decision review` shows: the decision a person is about to rule on, and the count
 * the session ends with.
 *
 * Each field is one line of the renderer's (`fact`), so the width rule is the CLI's: a long
 * reason is folded between words at the terminal's width and never cut. The text of a field
 * goes through the rule of the line, so a reason with a newline in it is one line here.
 */

import { oneLine } from '../one-line.js';
import { fact, subjectLine } from './detail.js';
import type { Line } from './line.js';

/** A decision as the review shows it. */
export interface Shown {
  readonly adr: string;
  readonly id: string;
  readonly title: string;
  readonly rationale: string;
  readonly alternatives?: string;
}

/** The lines for the decision at `position` of `total`, in the order a person reads them. */
export function proposalLines(shown: Shown, position: number, total: number): Line[] {
  return [
    subjectLine(`${shown.adr} (${shown.id})`, `${position} of ${total}`),
    fact(`Title: ${oneLine(shown.title)}`),
    fact(`Why: ${oneLine(shown.rationale)}`),
    ...(shown.alternatives !== undefined
      ? [fact(`Turned down: ${oneLine(shown.alternatives)}`)]
      : []),
  ];
}

/** The line a review ends with: what was ruled, and what was left. */
export function reviewedSummary(counts: {
  readonly accepted: number;
  readonly rejected: number;
  readonly skipped: number;
}): string {
  return `Reviewed: ${counts.accepted} accepted, ${counts.rejected} rejected, ${counts.skipped} skipped.`;
}

/** Who made an accept, as the list of the rules a person did not accept themselves words it. */
export function acceptedByWords(accepted: {
  readonly who: string;
  readonly which?: string;
  readonly at: string;
}): string {
  // An accept with no `which` is "no agent declared" (ADR-608): the seat it was made at is not
  // recorded, so it is never worded as a person's.
  const by =
    accepted.which !== undefined ? `the agent ${oneLine(accepted.which)}` : 'no agent declared';
  return `accepted ${accepted.at.slice(0, 10)}, ${by}`;
}

/** The lines for a rule in force the review shows and marks shown, at `position` of `total`. */
export function ruleShownLines(
  shown: Shown & {
    readonly accepted: { readonly who: string; readonly which?: string; readonly at: string };
  },
  position: number,
  total: number,
): Line[] {
  return [
    subjectLine(`${shown.adr} (${shown.id})`, `${position} of ${total}`),
    fact(`Title: ${oneLine(shown.title)}`),
    fact(`In force: ${acceptedByWords(shown.accepted)}`),
    fact(`Why: ${oneLine(shown.rationale)}`),
    ...(shown.alternatives !== undefined
      ? [fact(`Turned down: ${oneLine(shown.alternatives)}`)]
      : []),
  ];
}

/** The line the pass over the rules in force ends with: how many were shown and marked. */
export function shownSummary(shown: number, left: number): string {
  return left === 0
    ? `Shown and marked: ${shown}.`
    : `Shown and marked: ${shown}; ${left} not shown, still on the list.`;
}
