/**
 * THE TOUR, SHOWN: drawn one page at a time on a terminal, printed whole where there is none, and
 * remembered once it has been opened on a terminal.
 *
 * IT WRITES NOTHING BUT ONE FIELD of the machine's state (`machine-state.ts`, outside the proof): no event,
 * no tree, no project. The field is set when the tour OPENS, so a Ctrl-C on the first page does not bring
 * it back the next time; a state file that cannot be read counts as seen and is never written over.
 */

import { resolveTrees } from '@mnema/core';
import { type Asking, putTheQuestion } from '../init/flow.js';
import { isALeave, type Step } from '../init/keys.js';
import { DONE, heading, LEFT } from '../init/screens.js';
import { readMachineState, writeMachineState } from '../machine-state.js';
import type { Line } from '../presentation/line.js';
import type { Keystroke } from '../repl/editing.js';
import type { Here } from '../wiring/context.js';
import { drawnPage, TOUR, TOUR_END, wholeTour } from './pages.js';

/** What a key does to the page the tour is on: on, back, or out. */
export function onTheTour(at: number, stroke: Keystroke): Step<number, true> {
  if (isALeave(stroke)) return { kind: 'left' };
  if (stroke.ctrl) return { kind: 'stay', state: at };
  if (stroke.return || stroke.rightArrow || stroke.downArrow) {
    return at + 1 >= TOUR.length ? { kind: 'done', answer: true } : { kind: 'stay', state: at + 1 };
  }
  if (stroke.leftArrow || stroke.upArrow) return { kind: 'stay', state: Math.max(0, at - 1) };
  return { kind: 'stay', state: at };
}

/** Whether this machine has not seen the tour: where it cannot say, it has. */
export function theTourIsNew(here: Pick<Here, 'cwd' | 'env'>): boolean {
  return !readMachineState(resolveTrees(here.cwd, here.env).global).tourSeen;
}

/** Marks the tour as seen on this machine. A machine that cannot keep it shows it again; nothing else is undone. */
function markSeen(here: Pick<Here, 'cwd' | 'env'>): void {
  const dir = resolveTrees(here.cwd, here.env).global;
  try {
    writeMachineState(dir, { ...readMachineState(dir), tourSeen: true });
  } catch {
    // The tour only explains: failing to remember it is not worth stopping it.
  }
}

/** The lines left on the page when the tour was read to its end, and when the person left. */
const FINISHED: readonly Line[] = [heading(DONE, TOUR_END)];
const LEFT_THE_TOUR: readonly Line[] = [
  heading(LEFT, 'Left the tour. `mnema tour` shows it again.'),
];

/** The tour on a terminal: marked as seen as it opens, then one page at a time. */
export async function tourAtATerminal(
  asking: Asking,
  here: Pick<Here, 'cwd' | 'env'>,
): Promise<void> {
  markSeen(here);
  await putTheQuestion<number, true>(asking, {
    initial: 0,
    page: drawnPage,
    on: onTheTour,
    answered: () => FINISHED,
    left: LEFT_THE_TOUR,
  });
}

/** The tour as running text, for where there is no terminal. Nothing is remembered. */
export function tourAsText(width: number): readonly Line[] {
  return wholeTour(width);
}
