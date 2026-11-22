/**
 * What `mnema rules test` prints: one line per case, `MATCH` or `MISMATCH` with the path, what it
 * met and the ids of the rules behind that, then how many cases met their verdict.
 *
 * Every value on a line came from outside this product (a path typed into a file, a rule's id), so
 * each goes through {@link oneLine}; the words between are this surface's own. The mismatch is a
 * verdict like `guard`'s and carries no colour of its own: the word says it, and the exit code
 * is what a script reads.
 */

import type { CaseResult } from '../commands/rules-test.js';
import { oneLine } from '../one-line.js';
import type { Render } from './render.js';
import { statement } from './verdict.js';

/** The lines the verb prints for a person, in the order the file declared its cases. */
export function rulesTestReport(render: Render, cases: readonly CaseResult[]): string[] {
  const lines = cases.map((one) => {
    const by = one.by.length === 0 ? '' : ` (${one.by.map(oneLine).join(', ')})`;
    return render(
      one.matched
        ? statement('MATCH', `${oneLine(one.path)}: ${one.got}${by}`)
        : statement(
            'MISMATCH',
            `${oneLine(one.path)}: expected ${one.expect}, got ${one.got}${by}`,
          ),
    );
  });
  const met = cases.filter((one) => one.matched).length;
  return [...lines, `${met} of ${cases.length} case(s) met their verdict.`];
}
