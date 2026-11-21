/**
 * WHAT THE TOUR SAYS: four pages that only explain.
 *
 * The tour is for somebody who has just typed the name of the program on a machine that has never run it.
 * It says what the record is, what `mnema init` chooses and why, how an agent reads the record, and the
 * commands a person types. It writes nothing, founds nothing and asks nothing: the pages are text, and the
 * rows of the second one are the ones `init` prints after a founding (`chose`, in `init/summary.ts`), so
 * what the tour promises and what a founding does are one sentence.
 *
 * THE PAGES ARE LINES OF THE TRAIL, the drawing `init` already uses, so the colour and the fold are the one
 * renderer's. On a terminal one page is drawn at a time (`./run.ts`); without one they are printed in order
 * as running text, which is what `mnema tour` says in a pipe.
 */

import { paragraph, roomOf, wrap } from '../init/layout.js';
import { DONE, dim, END, heading, plain, theGuide, trail } from '../init/screens.js';
import {
  ACCEPTS_LATER,
  AGENTS_MAY_ACCEPT,
  chose,
  INSTRUCTIONS_LATER,
  instructionFilesDone,
  PULL_DONE,
} from '../init/summary.js';
import type { Line } from '../presentation/line.js';
import { widthOfText } from '../presentation/width.js';

/** One page: a title, its paragraphs, and what follows them (rows of what `init` does, or commands). */
interface Page {
  readonly title: string;
  readonly says: readonly string[];
  /** Rows of what `init` does, drawn by the same functions and from the same texts as init's own list. */
  readonly rows?: (width: number) => readonly Line[];
  /** Commands, each with what it does. */
  readonly commands?: readonly { readonly command: string; readonly does: string }[];
}

/**
 * The rows of what init does, as init says them: the default founding writes the four instruction files, asks
 * who may accept, and sets up the pull where there is a remote. The texts are init's own (`init/summary.ts`).
 */
export function tourRowsOfInit(width: number): readonly Line[] {
  return [
    ...chose(instructionFilesDone(4, 0), INSTRUCTIONS_LATER, width),
    ...chose(AGENTS_MAY_ACCEPT, ACCEPTS_LATER, width),
    ...paragraph(trail, PULL_DONE, width, '  done   '),
  ];
}

/** The tour, in the order it is read. */
export const TOUR: readonly Page[] = [
  {
    title: 'What the record is',
    says: [
      'mnema keeps a signed record of the decisions behind the work, in the repository where the work happens: each decision with its reasons and the options turned down.',
      'The record is append-only: nothing in it is edited or deleted, a later decision replaces an earlier one and names it. Every event is signed, and `mnema verify` checks the whole of it on your machine, with no server involved.',
    ],
  },
  {
    title: 'What `mnema init` chooses, and why',
    says: [
      'In a project, `mnema init` founds `.mnema/` and says one line for each choice it made, with the command that changes it later. For example:',
    ],
    rows: tourRowsOfInit,
  },
  {
    title: 'How an agent reads it',
    says: [
      'An agent reads the record through the instruction files, which tell it to ask, and through the tools of `mnema mcp` in a host that has the plugin: what is in force, what awaits a ruling, the rules for the file it is about to change.',
      'An agent records what was settled as a proposal; it waits for a person unless you chose that an agent may accept what you choose (`mnema switch` changes it).',
    ],
    commands: [
      { command: 'mnema brief', does: 'what governs the work here, as an agent reads it' },
    ],
  },
  {
    title: 'The commands',
    says: ['The ones to start with:'],
    commands: [
      { command: 'mnema init', does: 'found a project here' },
      { command: 'mnema status', does: 'where things stand' },
      { command: 'mnema search <words>', does: 'find what was recorded' },
      { command: 'mnema verify', does: 'check the record, signature by signature' },
      { command: 'mnema doctor', does: 'check this machine and the hosts' },
      { command: 'mnema --help', does: 'every verb there is' },
    ],
  },
];

/** What the last words of the tour say: where the menu is, and how to come back here. */
export const TOUR_END =
  'That is the tour. `mnema` opens the menu from now on, and `mnema tour` shows this again.';

/** The words of the keys, under each page drawn on a terminal. */
export const TOUR_KEYS = 'Enter or → next · ← back · Esc leaves';

/** The widest command of a page, so the sentences beside the commands line up. */
function widest(page: Page): number {
  return Math.max(0, ...(page.commands ?? []).map((each) => widthOfText(each.command)));
}

/** One page as lines of the trail: the title, its paragraphs, then its rows or commands. */
export function pageLines(page: Page, width: number): readonly Line[] {
  const lines: Line[] = [heading(DONE, page.title), theGuide];
  for (const [at, words] of page.says.entries()) {
    if (at > 0) lines.push(theGuide);
    lines.push(...paragraph(trail, words, width, '  '));
  }
  if (page.rows !== undefined) lines.push(theGuide, ...page.rows(width));
  const pad = widest(page);
  if (page.commands !== undefined && page.commands.length > 0) {
    lines.push(theGuide);
    for (const each of page.commands) {
      lines.push(
        trail(
          plain(`  ${each.command}${' '.repeat(pad - widthOfText(each.command))}`),
          dim(`  ${each.does}`),
        ),
      );
    }
  }
  return lines;
}

/** The page at `at`, drawn with the keys under it. */
export function drawnPage(at: number, width: number): readonly Line[] {
  const page = TOUR[at];
  if (page === undefined) return [];
  return [
    ...pageLines(page, width),
    theGuide,
    trail(dim(`  ${String(at + 1)} of ${String(TOUR.length)}  ·  ${TOUR_KEYS}`)),
  ];
}

/** The whole tour as lines, for where there is no terminal: every page in order, then the end. */
export function wholeTour(width: number): readonly Line[] {
  const lines: Line[] = [];
  for (const page of TOUR) lines.push(...pageLines(page, width), theGuide);
  for (const [at, row] of wrap(TOUR_END, roomOf(width)).entries()) {
    lines.push({ indent: 0, parts: [plain(at === 0 ? `${END}  ${row}` : `   ${row}`)] });
  }
  return lines;
}
