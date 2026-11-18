/**
 * What `mnema tail repair` says: line by line what it put back, or the one reason it wrote nothing.
 *
 * THE REFUSALS NAME THE LINE AND THE WAY OUT, and none of them offers to do what the verb never
 * does (ADR-399): a line it cannot trust is not guessed, signed or cut. A line a newer mnema wrote
 * is told to be read by updating mnema, which is the way out the unreadable-line refusals keep.
 */

import type { TailRepairDone, TailRepairRefused } from '../commands/tail-repair.js';
import { oneLine } from '../one-line.js';
import { fact } from './detail.js';
import type { Render } from './render.js';

/** The report of a repair that finished: nothing to do, or each line put back and where the original is. */
export function tailRepairReport(render: Render, done: TailRepairDone): string[] {
  if (done.repaired.length === 0) {
    return [
      `Nothing to repair in tail ${oneLine(done.tail)}: every line of its segments reads and holds its hash.`,
    ];
  }
  const lines = done.repaired.map((one) =>
    render(
      fact(
        `put back line ${one.line} of ${oneLine(one.segment)} (seq ${one.seq}), which ${
          one.was === 'unreadable' ? 'did not read' : 'did not hold its hash'
        }, as ${oneLine(done.from)} holds it`,
      ),
    ),
  );
  return [
    `Repaired tail ${oneLine(done.tail)}: ${done.repaired.length} line(s) put back from ${oneLine(done.from)}.`,
    ...lines,
    ...done.kept.map((path) => render(fact(`the segment as it was is kept at ${oneLine(path)}`))),
    render(
      fact(
        'the repaired file is a change in your working tree: `mnema verify` says whether the record holds, and the change is yours to commit',
      ),
    ),
  ];
}

/** The sentence of a refusal, for the first line of the error stream. */
export function tailRepairRefusal(refused: TailRepairRefused, tail: string): string {
  switch (refused.reason) {
    case 'NO_PROJECT':
      return '';
    case 'UNKNOWN_TAIL':
      return `There is no tail ${oneLine(tail)} in the project’s public record here: \`mnema tail list\` spells the tails there are.`;
    case 'NOT_THE_PUBLIC_TREE':
      return `Nothing was written: tail ${oneLine(tail)} is in ${refused.tree}, which git does not keep, so there is no committed line to put back. Update mnema if a newer one wrote the line, restore the file from a copy, or repair or remove the line by hand.`;
    case 'NOT_A_REPOSITORY':
      return 'Nothing was written: this record is not in a git repository, so there is no committed line to put back. Restore the file from a copy.';
    case 'NO_SUCH_REVISION':
      return `Nothing was written: ${oneLine(refused.from)} is not a revision of this repository that holds a commit.`;
    case 'LINE':
      return lineRefusal(refused.refusal, refused.from, tail);
  }
}

function lineRefusal(
  refusal: Extract<TailRepairRefused, { reason: 'LINE' }>['refusal'],
  from: string,
  tail: string,
): string {
  const where = `line ${refusal.line} of ${oneLine(refusal.segment)} in tail ${oneLine(tail)}`;
  switch (refusal.reason) {
    case 'CONFLICT_MARKS':
      return `Nothing was written: ${where} is a conflict marker git left, and sides of a conflict are not joined here. Redo the merge, with the record's merge driver in place (\`mnema doctor --fix merge-driver\`), and ask again.`;
    case 'NOT_IN_REVISION':
      return `Nothing was written: ${oneLine(from)} holds no ${where}, as it is here (the file is not committed there, or is shorter). Name another revision with \`--from\`.`;
    case 'NEWER_MNEMA':
      return `Nothing was written: ${where} is the same bytes in ${oneLine(from)} and this mnema cannot read it: a newer mnema wrote it. Update mnema.`;
    case 'NOT_COMMITTED_INTACT':
      return `Nothing was written: ${where} is damaged in ${oneLine(from)} too, or the revision holds a different line that does not read or does not hold its hash. Try \`--from\` with an older revision, from before the damage was committed.`;
    case 'NOT_CHAINED':
      return `Nothing was written: the line ${oneLine(from)} holds for ${where} does not chain to the line ${
        refusal.side === 'after' ? 'after' : 'before'
      } it as the file is here, so it is not the line that was written there. Try \`--from\` with an older revision.`;
  }
}
