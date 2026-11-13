/**
 * THE VERDICT ON A MEASUREMENT: pure, so a test can hand it fixtures and the weekly run hands it
 * what it measured.
 *
 * TWO SENTENCES, AND NOTHING ELSE JUDGES (`budget.json` holds their numbers):
 * - the time on the large record is at most `ratio` times the time on the small one, for every
 *   command and for cold and warm alike. The records differ threefold, so a ratio of 3.0 is the
 *   most that linear growth allows, and a command that has started to read the whole table once per
 *   rule (the shape the fix for the replaced-rule lookup removed) is far above it;
 * - the time of every cell stays within `factor` times the median of the first measurement, the
 *   number written beside it in `first`, which is what turns "does not grow badly" into "has not
 *   got slower than it was when somebody last looked".
 *
 * A CELL WITH NO FIRST NUMBER IS A FAILURE, not a pass: a budget that says nothing about a cell
 * reads exactly like one the cell kept.
 */

/**
 * The key of a cell in `budget.json`'s `first`.
 *
 * @param {{ command: string, state: string, size: number }} cell
 * @returns {string}
 */
export const cellKey = (cell) => `${cell.command} | ${cell.state} | ${cell.size}`;

/**
 * The median of a list of numbers: the middle one, or the mean of the two in the middle.
 *
 * @param {readonly number[]} samples
 * @returns {number}
 */
export function median(samples) {
  if (samples.length === 0) throw new Error('a median of nothing');
  const sorted = [...samples].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const at = (/** @type {number} */ index) => sorted[index] ?? 0;
  return sorted.length % 2 === 1 ? at(middle) : (at(middle - 1) + at(middle)) / 2;
}

/**
 * @typedef {{ command: string, state: 'cold' | 'warm', size: number, median: number, samples: number[] }} Cell
 * @typedef {{ ratio: number, factor: number, small: number, large: number, runs: number, first: Record<string, number> }} Budget
 */

/**
 * @param {readonly Cell[]} cells
 * @param {Budget} budget
 * @returns {{ ok: boolean, failures: string[], ratios: { command: string, state: string, ratio: number }[] }}
 */
export function judge(cells, budget) {
  /** @type {string[]} */
  const failures = [];
  /** @type {{ command: string, state: string, ratio: number }[]} */
  const ratios = [];
  /** @type {(command: string, state: string, size: number) => Cell | undefined} */
  const at = (command, state, size) =>
    cells.find((c) => c.command === command && c.state === state && c.size === size);

  const shapes = new Set(cells.map((c) => `${c.command}\u0000${c.state}`));
  for (const shape of shapes) {
    const [command = '', state = ''] = shape.split('\u0000');
    const small = at(command, state, budget.small);
    const large = at(command, state, budget.large);
    if (small === undefined || large === undefined) {
      failures.push(
        `${command} (${state}): not measured at both ${budget.small} and ${budget.large} decisions`,
      );
      continue;
    }
    const ratio = large.median / small.median;
    ratios.push({ command, state, ratio });
    if (ratio > budget.ratio) {
      failures.push(
        `${command} (${state}): ${large.median.toFixed(0)} ms on ${budget.large} decisions is ${ratio.toFixed(2)} times ${small.median.toFixed(0)} ms on ${budget.small}, over the ${budget.ratio} the growth of the record allows`,
      );
    }
  }
  for (const cell of cells) {
    const first = budget.first[cellKey(cell)];
    if (typeof first !== 'number' || !(first > 0)) {
      failures.push(`${cellKey(cell)}: the budget has no first measurement for this cell`);
      continue;
    }
    const ceiling = first * budget.factor;
    if (cell.median > ceiling) {
      failures.push(
        `${cellKey(cell)}: ${cell.median.toFixed(0)} ms is over ${ceiling.toFixed(0)} ms (${budget.factor} times the ${first} ms of the first measurement)`,
      );
    }
  }
  return { ok: failures.length === 0, failures, ratios };
}
