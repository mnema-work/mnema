/**
 * The `mnema tour` wiring: what it declares, and what it prints.
 *
 * `mnema tour` shows what mnema is, page by page, in the words the first run of the bare name uses. At a
 * terminal the pages are drawn one at a time and the keys move between them; without one the same pages are
 * printed in order, as running text. It reads and writes nothing of the record, founds no project, and is
 * not a tool an agent calls: it is for the person (ADR-432).
 *
 * AT A TERMINAL IT MARKS THE MACHINE AS HAVING SEEN IT (one field of `machine-state.json`), so the bare name
 * opens the menu next time; in a pipe nothing is written at all.
 */

import type { Command } from 'commander';
import { here } from './context.js';
import { type Declared, readsTheRecord, type Wiring } from './verb.js';

/** The word the verb is registered under. */
export const TOUR_VERB = 'tour';

/** Registers `mnema tour` on the program. */
export function registerTour(program: Command, wiring: Wiring): Declared {
  const { io, render } = wiring;
  const tour = program
    .command(TOUR_VERB)
    .description('show what mnema is and how it is used, page by page')
    .addHelpText(
      'after',
      [
        '',
        'Four pages: what the record is, what `mnema init` chooses and why, how an agent reads it, and the',
        'commands to start with. At a terminal one page is drawn at a time (Enter or → for the next, ← for',
        'the one before, Esc to leave); without one the pages are printed in order. It writes nothing to',
        'the record and founds no project; at a terminal it notes in a file of this machine, outside the',
        'record, that the tour was shown. The first time `mnema` is run on a machine at a terminal, with no',
        'arguments, this is what it opens, in place of the menu; after that the menu is back.',
      ].join('\n'),
    )
    .action(async () => {
      const [{ tourAsText, tourAtATerminal }, { theWidthOf }] = await Promise.all([
        import('../tour/run.js'),
        import('../init/layout.js'),
      ]);
      const terminal = io.aPersonIsHere === true ? io.terminal : undefined;
      if (terminal === undefined) {
        for (const line of tourAsText(theWidthOf(render))) io.out(render(line));
        return;
      }
      await tourAtATerminal({ io, render, terminal }, here());
    });
  return readsTheRecord(tour);
}
