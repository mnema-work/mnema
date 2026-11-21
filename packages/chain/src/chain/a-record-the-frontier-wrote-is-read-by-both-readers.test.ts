/**
 * A RECORD THE FRONTIER WROTE, held by both readers (FORMAT.md, "What this product's writer cites").
 *
 * `__fixtures__/written-by-the-frontier` is a record this product's command line wrote with the
 * citation of the frontier (ADR-321), and it is frozen: ten tails of one key (a founding with its
 * backup key, then one write each from a new installation), a decision recorded in one tail, a task
 * created in one and moved in two others, a note taken back from another tail. Every tail after the
 * first was founded behind the others, so its first line cites the frontier (and the tail that holds
 * the enrolment), not every head. It is never written again. Both readers have to verify it, apply
 * every move, and refuse nothing, and no first line is the length that citing every head would give.
 */

import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { catalogUpcasters } from '../events/registry.js';
import { verify } from './chain.js';

const VERIFIER = fileURLToPath(new URL('../../verifier/mnema_verify.py', import.meta.url));
const FRONTIER = fileURLToPath(new URL('./__fixtures__/written-by-the-frontier', import.meta.url));

interface SecondReading {
  readonly verdict: string;
  readonly findings: readonly {
    readonly level: string;
    readonly section: string;
    readonly what: string;
  }[];
}

function secondReading(record: string): SecondReading {
  const run = spawnSync('python3', ['-I', VERIFIER, '--json', 'record', record], {
    encoding: 'utf-8',
  });
  if (run.stdout === '') {
    throw new Error(`the second reader produced no verdict. stderr: ${run.stderr}`);
  }
  return JSON.parse(run.stdout) as SecondReading;
}

/** The first line of every tail's first segment, read off the bytes. */
function firstLines(): string[] {
  const tails = join(FRONTIER, 'tails');
  return readdirSync(tails).map(
    (tail) => readFileSync(join(tails, tail, '000001.jsonl'), 'utf-8').split('\n')[0] as string,
  );
}

describe('a record the frontier wrote', () => {
  it('is verified by the product, every event signed, with nothing refused and no move left unapplied', () => {
    const here = verify(FRONTIER, catalogUpcasters());
    expect(here.issues).toEqual([]);
    expect(here.ok).toBe(true);
    expect(here.fullySigned).toBe(true);
    expect(here.tails).toHaveLength(10);
    expect(here.tails.reduce((all, tail) => all + tail.entryCount, 0)).toBe(18);
    expect(here.census.map((note) => note.kind)).toEqual(['backup-key']);
  });

  it('is verified by the second reader too, six moves applied and nothing left unchecked', () => {
    const there = secondReading(FRONTIER);
    expect(there.verdict).toBe('VERIFIED');
    expect(there.findings.filter((f) => f.level === 'FAIL' || f.level === 'UNCHECKED')).toEqual([]);
    expect(
      there.findings
        .filter((f) => f.section === '6.7')
        .map((f) => `${f.level} ${f.section} ${f.what.slice(0, 32)}`),
    ).toEqual(['ok 6.7 every one of the 6 move(s) is on']);
  });

  it('founded each tail behind the others with a line far short of citing every head', () => {
    const lines = firstLines();
    expect(Math.max(...lines.map((line) => line.length))).toBeLessThan(1000);
    // Every tail but the first cites at most the frontier, the enrolment's tail and the subject's.
    const cited = lines.map((line) => (JSON.parse(line).event.after ?? []).length);
    expect(Math.max(...cited)).toBeLessThanOrEqual(4);
    expect(cited.filter((count) => count === 0)).toHaveLength(1);
  });
});
