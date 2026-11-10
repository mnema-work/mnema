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
