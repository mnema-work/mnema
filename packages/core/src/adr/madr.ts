/**
 * Writing ONE decision of the record as a MADR document: the other direction of `read.ts`.
 *
 * A READING, NOT THE RECORD. The file names the decision it was derived from and says, in the
 * file itself, that it is a reading of the signed record and not the source of truth: whoever
 * opens it without the tool at hand learns that before the first section. Nothing in the file
 * proves anything; `mnema verify` and `mnema show <id>` do.
 *
 * THE FORM IS THE ONE `readAdr` READS, so the round trip is a property that can be tested:
 * YAML frontmatter (`status`, `date`, and the decision's id), a level-1 title, a blockquote that
 * says it is derived, `## Decision Outcome` holding the rationale, and `## Alternatives
 * Considered` holding what was turned down, verbatim. MADR's own `## Considered Options` lists
 * EVERY option, the chosen one included, and the reader refuses to call that list "turned down"
 * unless the outcome names the chosen option in a form it recognizes; the record's alternatives
 * are free text with the chosen one already left out, so the section carries the label the reader
 * takes verbatim. There is no `## Context and Problem Statement`: the record has one field for
 * the why, and inventing a second one would put words in the file that nobody wrote.
 *
 * IT SAYS WHEN A DECISION WILL NOT COME BACK AS THE SAME WORDS: a rationale or alternatives with a
 * line that is a `##` heading is cut where the reader cuts it, a title with `*` loses it, and a
 * text with leading or trailing space is trimmed. The file is still written, and the caller is
 * told which decisions did not survive the trip instead of finding out at the import. It does not
 * run the reader over the text to find out: that would put record text through the reader's
 * patterns, and the cases here (`madr.test.ts`) are what hold the two sides together.
 */

import type { DecisionProjection } from '../projections/decision.js';

/** A decision as a MADR document, and whether the document reads back as the decision. */
export interface MadrDocument {
  readonly text: string;
  /** False when the text holds something the reader would cut or trim, so the import would not give the same words. */
  readonly faithful: boolean;
}

/** The line every file carries, so a re-export can tell its own files from a person's. */
export const DERIVED_KEY = 'mnema-decision';

/**
 * Whether a body holds a line the reader cuts at: a `##` heading starts a section of its own and a
 * `###` one ends the decision's text, so what follows it would not come back as the same words.
 * A scan of lines, with no pattern run over the text.
 */
function cutsTheReading(body: string): boolean {
  return body.split('\n').some((line) => line.startsWith('##'));
}

/**
 * `decision` as a MADR document. `labelOf` names another decision by its `ADR-<n>` label for the
 * supersession link, and falls back to the id it is given when the decision is not known here.
 */
export function madrOf(
  decision: DecisionProjection,
  labelOf: (id: string) => string = (id) => id,
): MadrDocument {
  const status =
    decision.supersededBy !== undefined
      ? `superseded by ${labelOf(decision.supersededBy)}`
      : decision.state;
  const front = [
    `status: ${status}`,
    `date: ${decision.createdAt.slice(0, 10)}`,
    `${DERIVED_KEY}: ${decision.id}`,
    ...(decision.supersedes !== undefined ? [`supersedes: ${labelOf(decision.supersedes)}`] : []),
    ...(decision.supersededBy !== undefined
      ? [`superseded-by: ${labelOf(decision.supersededBy)}`]
      : []),
  ];
  const parts = [
    `---\n${front.join('\n')}\n---`,
    `# ${decision.title}`,
    `> Derived from the signed record: this file is a reading of decision ${decision.id} (${decision.adr}), not the source of truth. Change the decision in the record, never here; \`mnema show ${decision.id}\` and \`mnema verify\` say what the record holds.`,
    `## Decision Outcome\n\n${decision.rationale}`,
    ...(decision.alternatives !== undefined
      ? [`## Alternatives Considered\n\n${decision.alternatives}`]
      : []),
  ];
  const text = `${parts.join('\n\n')}\n`;
  const faithful =
    ![decision.rationale, decision.alternatives ?? ''].some(cutsTheReading) &&
    !decision.title.includes('*') &&
    decision.rationale === decision.rationale.trim() &&
    (decision.alternatives === undefined || decision.alternatives === decision.alternatives.trim());
  return { text, faithful };
}
