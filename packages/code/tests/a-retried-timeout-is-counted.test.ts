/**
 * A CASE THAT ENDED ON ITS CEILING IS RUN ONCE MORE IN CI, AND THE RETRY MUST NOT HIDE IT.
 *
 * Two halves, and the second is the reason the first is allowed. The retry only fires where `CI`
 * is set and only for an error that says a case or a hook timed out; the ledger then records
 * the case that passed on the retry, with nothing about the attempt that passed to make it
 * look slow, and the page names it as a flake instead of reading green.
 *
 * The cases stand in for the reporter's own objects, which only a running vitest builds.
 */

import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { A_TIMEOUT, retryFor } from '../../../.github/a-timeout-is-run-once-more/retry.mjs';
import Ledger, { type Book } from '../../../.github/why-it-went-red/ledger.mjs';
import {
  decide,
  exitCodeOf,
  type Published,
  type Reading,
  render,
} from '../../../.github/why-it-went-red/verdict.mjs';

/** A case that passed first time and quickly: it leaves its ceiling in the ledger and nothing else. */
function quick(): never {
  return {
    ...(passedOnTheRetry() as object),
    diagnostic: () => ({ duration: 40, startTime: 1, retryCount: 0, flaky: false }),
  } as never;
}

/** What a retried case looks like to the reporter: it passed, quickly, on its second attempt. */
function passedOnTheRetry(): never {
  return {
    name: 'waits on the disk',
    parent: { type: 'module', name: 'a file' },
    module: { moduleId: `${process.cwd()}/packages/x/a.test.ts` },
    options: { timeout: 5000 },
    result: () => ({ state: 'passed' }),
    diagnostic: () => ({ duration: 40, startTime: 1, retryCount: 1, flaky: true }),
  } as never;
}

/** The ledger a run writes, read back from where it was told to write it. */
function ledgerOf(cases: never[]): Book {
  const dir = mkdtempSync(join(tmpdir(), 'retry-ledger-'));
  const at = join(dir, 'ledger.json');
  const before = process.env.MNEMA_LEDGER;
  process.env.MNEMA_LEDGER = at;
  try {
    const ledger = new Ledger();
    for (const one of cases) ledger.onTestCaseResult(one);
    const module = {
      moduleId: join(dir, 'a.test.ts'),
      children: { allTests: () => cases },
      errors: () => [],
    };
    ledger.onTestRunEnd([module] as never, []);
    return JSON.parse(readFileSync(at, 'utf-8'));
  } finally {
    if (before === undefined) delete process.env.MNEMA_LEDGER;
    else process.env.MNEMA_LEDGER = before;
    rmSync(dir, { recursive: true, force: true });
  }
}

function published(result: Reading): Published {
  if (result.verdict === 'RULER BROKEN') throw new Error(`the ruler broke: ${result.broken}`);
  return result;
}

describe('where a timed-out case is run once more', () => {
  it('retries nothing off CI, and nothing in the flake sampler', () => {
    expect(retryFor({})).toBe(0);
    expect(retryFor({ CI: '' })).toBe(0);
    expect(retryFor({ CI: 'true', MNEMA_FIRST_ATTEMPT_ONLY: '1' })).toBe(0);
  });

  it('retries once in CI, and only an error that says something timed out', () => {
    const rule = retryFor({ CI: 'true' });
    expect(rule).toEqual({ count: 1, condition: A_TIMEOUT });
    if (rule === 0) throw new Error('CI must retry');
    expect(rule.condition.test('Test timed out in 5000ms.')).toBe(true);
    expect(rule.condition.test('Hook timed out in 10000ms.')).toBe(true);
    expect(rule.condition.test('expected 1 to be 2')).toBe(false);
    expect(rule.condition.test('Error: spawnSync node ETIMEDOUT')).toBe(false);
    expect(rule.condition.test('AssertionError: timed out')).toBe(false);
    // The phrase carried inside another message is not a timeout: this is what an assertion over
    // a child's output says, and it must be red on the first attempt.
    expect(rule.condition.test("expected 'child said: Test timed out in 123ms' to be 'ok'")).toBe(
      false,
    );
    expect(rule.condition.test('child said: Hook timed out in 10000ms')).toBe(false);
    // The phrase carried inside another message is not a timeout: this is what an assertion over
    // a child's output says, and it must be red on the first attempt.
    expect(rule.condition.test("expected 'child said: Test timed out in 123ms' to be 'ok'")).toBe(
      false,
    );
    expect(rule.condition.test('child said: Hook timed out in 10000ms')).toBe(false);
  });
});

describe('a case that passed on a retry is a flake, counted', () => {
  it('is written to the ledger however quick its last attempt was', () => {
    const book = ledgerOf([passedOnTheRetry()]);
    expect(book.cases).toHaveLength(1);
    expect(book.cases[0]).toMatchObject({ state: 'passed', retries: 1, flaky: true, duration: 40 });
  });

  it('and a case that passed first time and quickly is still left out', () => {
    expect(ledgerOf([quick()]).cases).toEqual([]);
  });

  it('is named by the page, and the run is not clean', () => {
    const book = ledgerOf([passedOnTheRetry()]);
    const asked: unknown[] = [];
    const result = published(
      decide({
        ledger: book,
        alone: (what) => {
          asked.push(what);
          return { ran: true, failed: false, duration: 1 };
        },
      }),
    );
    expect(result.verdict).toBe('SOMETHING TO READ');
    expect(result.flaky).toEqual([
      expect.objectContaining({
        file: 'packages/x/a.test.ts',
        name: 'waits on the disk',
        retries: 1,
      }),
    ]);
    // Nothing was red, so nothing was re-run: the flake is read off the first attempt.
    expect(result.reds).toEqual([]);
    expect(asked).toEqual([]);
    const page = render(result);
    expect(page).toContain('A retry made this run green');
    expect(page).toContain('failed once and passed on a retry');
    expect(page).toContain('waits on the disk');
  });

  it('and a run with no retried case says nothing about one', () => {
    const clean = published(
      decide({
        ledger: ledgerOf([quick()]),
        alone: () => ({ ran: true, failed: false, duration: 1 }),
      }),
    );
    expect(clean.verdict).toBe('CLEAN');
    expect(clean.flaky).toEqual([]);
    expect(render(clean)).not.toContain('passed on a retry');
  });
});

/** The workspace root: this file is `packages/code/tests/…`. */
const ROOT = join(import.meta.dirname, '../../..');

/** What a file says, as the text the wiring is read from. */
function textOf(path: string): string {
  return readFileSync(join(ROOT, path), 'utf-8');
}

/** The text of the step of a workflow that runs `needle`, from its `- name:` down to it. */
function stepRunning(workflow: string, needle: string): string {
  const at = workflow.indexOf(needle);
  if (at < 0) throw new Error(`no step runs ${needle}`);
  const from = workflow.lastIndexOf('\n      - name:', at);
  return workflow.slice(from, at);
}

/** What is wrong with the way the retry is wired, as sentences; empty when it is wired as said. */
function wiringFaults(files: { config: string; guards: string; sampler: string }): string[] {
  const faults: string[] = [];
  for (const [name, text] of [
    ['vitest.config.ts', files.config],
    ['vitest.guards.config.ts', files.guards],
  ] as const) {
    if (!text.includes('retry: retryFor(process.env),')) {
      faults.push(`${name} does not take its retry from retryFor(process.env)`);
    }
    if ((text.match(/\bretry\s*:/g) ?? []).length !== 1) {
      faults.push(`${name} names a retry other than the one retryFor gives`);
    }
  }
  if (!stepRunning(files.sampler, 'pnpm test \\').includes("MNEMA_FIRST_ATTEMPT_ONLY: '1'")) {
    faults.push('the sampler step that runs the suite does not turn the retry off');
  }
  return faults;
}

describe('the retry is wired as said, and nowhere else', () => {
  const files = () => ({
    config: textOf('vitest.config.ts'),
    guards: textOf('vitest.guards.config.ts'),
    sampler: textOf('.github/workflows/flake-sampler.yml'),
  });

  it('is the one rule in both configurations, and off in the sampler step', () => {
    expect(wiringFaults(files())).toEqual([]);
  });

  it('is not turned off for the CI runs that gate a merge', () => {
    expect(textOf('.github/workflows/ci.yml')).not.toContain('MNEMA_FIRST_ATTEMPT_ONLY');
  });

  it('goes red on a number written in the configuration, and on the sampler env deleted', () => {
    const kept = files();
    const number = kept.config.replace('retry: retryFor(process.env),', 'retry: 3,');
    expect(wiringFaults({ ...kept, config: number })).toEqual([
      'vitest.config.ts does not take its retry from retryFor(process.env)',
    ]);
    const deleted = kept.sampler.replace("MNEMA_FIRST_ATTEMPT_ONLY: '1'", '');
    expect(wiringFaults({ ...kept, sampler: deleted })).toEqual([
      'the sampler step that runs the suite does not turn the retry off',
    ]);
    expect(wiringFaults({ ...kept, guards: `${kept.guards}\n// retry: 2,` })).toEqual([
      'vitest.guards.config.ts names a retry other than the one retryFor gives',
    ]);
  });
});

describe('a green run is not reported as a failure', () => {
  it('titles the page for what it is and exits 0 when the suite passed', () => {
    const book = ledgerOf([passedOnTheRetry()]);
    const result = published(
      decide({ ledger: book, alone: () => ({ ran: true, failed: false, duration: 1 }) }),
    );
    expect(render(result, 0, true)).toContain('What this green run left to read');
    expect(render(result, 0, true)).not.toContain('Why it went red');
    expect(exitCodeOf(result, true)).toBe(0);
    // And when the suite did not pass, the same reading still exits 1.
    expect(exitCodeOf(result)).toBe(1);
  });
});
