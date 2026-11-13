// @reads-the-tree
/**
 * THE HOT PATH KEEPS ITS BUDGET: the verdict, handed measurements it can be wrong about.
 *
 * What runs weekly on a runner is a measurement of seven thousand writes and thirty process starts;
 * what is held here is the half that is not a measurement: the verdict that reads one, the issue it
 * opens or adds to, the commands it takes from the plugin's hooks file, and the budget file that has
 * to carry a number for every cell. The fixtures are hand-made medians, so each case can say which
 * sentence of the budget it breaks: the time on the large record against the small one, and the time
 * against the first measurement.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  THE_TITLE,
  tableOf,
  tellSomebody,
  theCommandsOf,
} from '../../../.github/the-hot-path-budget/measure.mjs';
import { cellKey, judge, median } from '../../../.github/the-hot-path-budget/verdict.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const read = (path: string): string => readFileSync(join(ROOT, path), 'utf-8');
const BUDGET = JSON.parse(read('.github/the-hot-path-budget/budget.json')) as {
  ratio: number;
  factor: number;
  small: number;
  large: number;
  runs: number;
  first: Record<string, number>;
};

const COMMANDS = ['before an edit', 'session start, the document', 'session start, the notes'];

type Cell = {
  command: string;
  state: 'cold' | 'warm';
  size: number;
  median: number;
  samples: number[];
};

/** Every cell of a reading, with the median `at` says; the small record is the base. */
function reading(at: (cell: Omit<Cell, 'median' | 'samples'>) => number): Cell[] {
  return COMMANDS.flatMap((command) =>
    (['cold', 'warm'] as const).flatMap((state) =>
      [BUDGET.small, BUDGET.large].map((size) => {
        const median = at({ command, state, size });
        return { command, state, size, median, samples: [median] };
      }),
    ),
  );
}

/** A budget whose first measurement is 100 ms for every cell, with the file's ratio and factor. */
const HUNDRED = {
  ...BUDGET,
  first: Object.fromEntries(reading(() => 0).map((cell) => [cellKey(cell), 100])),
};

describe('the verdict on a measurement', () => {
  it('is within the budget when the large record costs what the small one does and nothing moved', () => {
    const verdict = judge(
      reading(() => 100),
      HUNDRED,
    );
    expect(verdict.failures).toEqual([]);
    expect(verdict.ok).toBe(true);
    expect(verdict.ratios.every((r) => r.ratio === 1)).toBe(true);
  });

  it('allows the growth of the record itself, and not a hair more', () => {
    // 3,000 decisions against 1,000 is three times the records: linear growth is the most allowed.
    const at = (ratio: number) =>
      judge(
        reading((c) => (c.size === BUDGET.large ? 100 * ratio : 100)),
        { ...HUNDRED, first: Object.fromEntries(reading(() => 0).map((c) => [cellKey(c), 1000])) },
      );
    expect(at(3).ok).toBe(true);
    const over = at(3.2);
    expect(over.ok).toBe(false);
    expect(over.failures).toHaveLength(6);
    expect(over.failures[0]).toContain('3.20 times');
  });

  it('names the command and the cache of a ratio that is over, and only that one', () => {
    const verdict = judge(
      reading((c) =>
        c.command === 'session start, the document' && c.state === 'cold' && c.size === BUDGET.large
          ? 100 * 3.5
          : 100,
      ),
      { ...HUNDRED, first: Object.fromEntries(reading(() => 0).map((c) => [cellKey(c), 1000])) },
    );
    expect(verdict.failures).toHaveLength(1);
    expect(verdict.failures[0]).toContain('session start, the document (cold)');
  });

  it('holds every cell to one and a half times the first measurement', () => {
    const at = (ms: number) =>
      judge(
        reading((c) => (c.size === BUDGET.small && c.command === 'before an edit' ? ms : 100)),
        HUNDRED,
      );
    expect(at(150).ok).toBe(true);
    const slow = at(151);
    expect(slow.ok).toBe(false);
    expect(slow.failures.some((f) => f.includes('before an edit | cold | 1000'))).toBe(true);
    expect(slow.failures.join('\n')).toContain('151 ms is over 150 ms');
  });

  it('fails a cell the budget carries no number for, rather than passing it', () => {
    const {
      [cellKey({ command: 'before an edit', state: 'warm', size: BUDGET.large })]: _,
      ...first
    } = HUNDRED.first;
    const verdict = judge(
      reading(() => 100),
      { ...HUNDRED, first },
    );
    expect(verdict.ok).toBe(false);
    expect(verdict.failures).toEqual([
      'before an edit | warm | 3000: the budget has no first measurement for this cell',
    ]);
  });

  it('fails a reading that lacks one of the two sizes', () => {
    const verdict = judge(
      reading(() => 100).filter((c) => c.size === BUDGET.small),
      HUNDRED,
    );
    expect(verdict.ok).toBe(false);
    expect(verdict.failures.filter((f) => f.includes('not measured at both'))).toHaveLength(6);
  });

  it('takes the median, the middle sample and the mean of the two middle ones', () => {
    expect(median([9, 1, 5])).toBe(5);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(() => median([])).toThrow();
  });
});

describe('the issue the verdict opens', () => {
  const book = (open?: string) => {
    const done: string[] = [];
    return {
      done,
      findOpen: () => open,
      comment: (number: string) => done.push(`comment on ${number}`),
      open: (title: string) => done.push(`open ${title}`),
    };
  };
  const readingOf = (cells: Cell[]) => ({
    runs: 5,
    sizes: [BUDGET.small, BUDGET.large],
    generatedInSeconds: 1,
    writes: 1,
    cells,
  });
  const fine = readingOf(reading(() => 100));
  const over = readingOf(reading((c) => (c.size === BUDGET.large ? 1000 : 100)));

  it('says nothing when the reading is within the budget', () => {
    const issues = book();
    expect(tellSomebody(fine, HUNDRED, issues, 'a run')).toBe('nothing');
    expect(issues.done).toEqual([]);
  });

  it('opens one issue under a title that never changes when the reading is over', () => {
    const issues = book();
    expect(tellSomebody(over, HUNDRED, issues, 'a run')).toBe('opened');
    expect(issues.done).toEqual([`open ${THE_TITLE}`]);
  });

  it('comments on the issue that is already open, and opens no second', () => {
    const issues = book('41');
    expect(tellSomebody(over, HUNDRED, issues, 'a run')).toBe('commented');
    expect(issues.done).toEqual(['comment on 41']);
  });

  it('prints the table the pull request and the summary carry: size, command, cache and median', () => {
    const table = tableOf(over, HUNDRED);
    expect(table).toContain('| 3000 | before an edit | cold | 1000 ms |');
    expect(table).toContain('| 1000 | session start, the notes | warm | 100 ms |');
    expect(table).toContain('Verdict: OVER the budget.');
    expect(tableOf(fine, HUNDRED)).toContain('Verdict: within the budget.');
  });
});

describe('what is measured is what the plugin runs', () => {
  const hooks = JSON.parse(read('plugin/hooks/hooks.json'));

  it('takes the edit gate and the two commands of the opening from the hooks file', () => {
    const specs = theCommandsOf(hooks);
    expect(specs.map((spec: { name: string }) => spec.name)).toEqual(COMMANDS);
    expect(specs[0]?.command).toContain('edit-refuses-a-write.mjs');
    expect(specs[0]?.command).toContain('--host qwen');
    expect(specs[1]?.command).toContain('session-start.mjs');
    expect(specs[2]?.command).toContain('session-recall.mjs');
  });

  it('refuses a hooks file that has lost one of them, because a ruler that measures nothing reads as a pass', () => {
    const without = (event: string, file: string) => ({
      hooks: {
        ...hooks.hooks,
        [event]: hooks.hooks[event].map((group: { hooks: { command?: string }[] }) => ({
          ...group,
          hooks: group.hooks.filter((hook) => !hook.command?.includes(file)),
        })),
      },
    });
    expect(() => theCommandsOf(without('SessionStart', 'session-start.mjs'))).toThrow(
      /session-start/,
    );
    expect(() => theCommandsOf(without('SessionStart', 'session-recall.mjs'))).toThrow(
      /session-recall/,
    );
    expect(() => theCommandsOf(without('PreToolUse', '--host qwen'))).toThrow(/gate/);
  });
});

describe('the budget file', () => {
  it('writes the two numbers of the decision and the sizes it is read at', () => {
    expect(BUDGET).toMatchObject({ ratio: 3, factor: 1.5, small: 1000, large: 3000, runs: 5 });
  });

  it('carries a first measurement for every cell, and nothing for a cell that is not measured', () => {
    const cells = reading(() => 0)
      .map(cellKey)
      .sort();
    expect(Object.keys(BUDGET.first).sort()).toEqual(cells);
    for (const [cell, ms] of Object.entries(BUDGET.first)) {
      expect(ms, cell).toBeGreaterThan(0);
    }
  });
});

describe('the weekly run', () => {
  const workflow = read('.github/workflows/hot-path-budget.yml');

  it('runs weekly and by hand, and a change to the instrument runs it once', () => {
    expect(workflow).toMatch(/schedule:\s*\n\s*#[^\n]*\n\s*#[^\n]*\n\s*- cron: '0 5 \* \* 1'/);
    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).toContain("- '.github/the-hot-path-budget/**'");
  });

  it('lets a job write an issue only off a pull request, and no job write anything else', () => {
    const writing = workflow.match(/issues: write/g) ?? [];
    expect(writing).toHaveLength(1);
    expect(workflow).toMatch(
      /if: \$\{\{ needs\.measure\.outputs\.over == 'true' && github\.event_name != 'pull_request' \}\}/,
    );
    expect(workflow).not.toMatch(/contents: write|pull-requests: write/);
  });

  it('runs the generator and the commands in a home of its own, with nothing else from the runner', () => {
    expect(workflow).toContain('-i HOME="$sandbox"');
    expect(workflow).toContain('measure.mjs scan');
  });
});
