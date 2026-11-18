// @reads-the-tree
/**
 * THE SUITE IS SPLIT INTO SHARDS WITHOUT LOSING ONE.
 *
 * `ci.yml` runs the suite as `shard: [1..N]` of `--shard=k/N` per Node. A matrix that lists two
 * shards while the steps say `/3` runs two thirds of the suite and every check it has is green;
 * a step that says `/4` in a matrix of three runs a different split from its neighbours and
 * leaves files in no shard. And the coverage floor is read off the shards merged, so the merge
 * must wait for the shards and must count the blobs it was handed: a merge of two blobs
 * reports a lower figure and blames the code. What is read is the workflow, as text.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const CI = readFileSync(join(ROOT, '.github/workflows/ci.yml'), 'utf-8');

/** The text of one top-level job of the file, from its header to the next job. */
function jobOf(all: string, id: string): string {
  const lines = all.split('\n');
  const from = lines.indexOf(`  ${id}:`);
  if (from < 0) return '';
  const length = lines.slice(from + 1).findIndex((line) => /^ {2}[A-Za-z]/.test(line));
  return lines.slice(from, length < 0 ? lines.length : from + 1 + length).join('\n');
}

/**
 * The text of one step of a job: from its `- name: <step>` line to the next step, comment lines
 * left out so that a sentence about `continue-on-error` is not read as the key. Empty when the job
 * has no such step.
 */
function stepOf(job: string, name: string): string {
  const lines = job.split('\n').filter((line) => !line.trim().startsWith('#'));
  const from = lines.findIndex((line) => line.trim() === `- name: ${name}`);
  if (from < 0) return '';
  const length = lines.slice(from + 1).findIndex((line) => /^ *- /.test(line));
  return lines.slice(from, length < 0 ? lines.length : from + 1 + length).join('\n');
}

/** Everything that is wrong with how `all` splits the suite; empty when it is split whole. */
export function faults(all: string): string[] {
  const found: string[] = [];
  const say = (what: string): number => found.push(what);

  const test = jobOf(all, 'test');
  if (test === '') return ['ci.yml has no job test'];
  const listed = /^\s*shard: \[(.+)\]\s*$/m.exec(test)?.[1];
  const shards = (listed ?? '').split(',').map((one) => one.trim().replace(/^['"]|['"]$/g, ''));
  if (listed === undefined) say('the matrix of the job test has no shard list');

  const steps = [...test.matchAll(/--shard=\$\{\{ matrix\.shard \}\}\/(\d+)/g)];
  if (steps.length === 0) say('no step of the job test takes --shard');
  const sizes = new Set(steps.map((one) => one[1]));
  if (sizes.size > 1)
    say(`the steps split the suite by different counts: ${[...sizes].join(', ')}`);
  const [size] = [...sizes];
  if (/--shard=(?!\$\{\{ matrix\.shard \}\}\/\d)/.test(test)) {
    say('a step takes --shard with something other than the matrix cell');
  }

  const cover = stepOf(test, 'Coverage of the shard');
  if (cover === '') {
    say('the job test has no step Coverage of the shard');
  } else {
    if (!/--shard=\$\{\{ matrix\.shard \}\}\/\d+/.test(cover)) {
      say('the step Coverage of the shard takes no --shard of the matrix cell');
    }
    if (/continue-on-error:/.test(cover)) {
      say('the step Coverage of the shard has continue-on-error, so a red suite passes');
    }
  }

  const named = /^ {4}name: (.+)$/m.exec(test)?.[1]?.trim() ?? '';
  const ends = /\/(\d+)\)?$/.exec(named)?.[1];
  if (size !== undefined && ends !== size) {
    say(
      `the name of the job test ends in ${ends === undefined ? 'no count' : `/${ends}`} and the steps split by ${size}`,
    );
  }

  const n = Number(size);
  const expected = Array.from({ length: n }, (_, i) => String(i + 1));
  if (size !== undefined && shards.join(',') !== expected.join(',')) {
    say(`the matrix lists shard ${shards.join(', ')} and the steps split by ${n}`);
  }

  const gate = jobOf(all, 'the-coverage-gate');
  if (gate === '') {
    say('ci.yml has no job the-coverage-gate');
  } else {
    if (!/^ {4}needs: \[changes, test\]$/m.test(gate))
      say('the coverage gate does not wait for the test job');
    if (size !== undefined && !gate.includes(`!= '${n}'`)) {
      say(`the coverage gate does not check that it was handed ${n} blobs`);
    }
    if (size !== undefined && !gate.includes(`blob-*-${n}.json`)) {
      say(`the coverage gate does not look for the blobs of a split by ${n}`);
    }
    if (!/pnpm exec vitest --merge-reports\S* --coverage/.test(gate)) {
      say('the coverage gate does not merge the reports with coverage on');
    }
    const merge = stepOf(gate, 'Merge the shards and check the thresholds');
    if (merge === '') {
      say('the coverage gate has no step Merge the shards and check the thresholds');
    } else if (/--coverage\.thresholds/.test(merge)) {
      say(
        'the merge step of the coverage gate carries a --coverage.thresholds flag, which turns the gate off',
      );
    }
    for (const step of ['Count the blobs', 'Merge the shards and check the thresholds']) {
      if (/continue-on-error:/.test(stepOf(gate, step))) {
        say(
          `the step ${step} of the coverage gate has continue-on-error, so the gate passes without a verdict`,
        );
      }
    }
    if (/^ {4}continue-on-error:/m.test(gate)) {
      say(
        'the job the-coverage-gate has continue-on-error, so a gate that fails does not fail the run',
      );
    }
  }
  return found;
}

describe('the suite is split whole', () => {
  it('lists every shard its steps split by, and the merge waits for them and counts them', () => {
    expect(faults(CI)).toEqual([]);
  });

  it('is red for a matrix of two shards under steps that split by three', () => {
    const mutated = CI.replace("shard: ['1', '2', '3']", "shard: ['1', '2']");
    expect(mutated).not.toBe(CI);
    expect(faults(mutated)).toEqual(['the matrix lists shard 1, 2 and the steps split by 3']);
    // The step `Test` still takes a --shard, so the count of the steps is consistent while the
    // coverage step of each Node 24 cell runs the whole suite.
    const unsplit = CI.replace(
      /(run: pnpm test:coverage)\n\s*--shard=\$\{\{ matrix\.shard \}\}\/3\n/,
      '$1\n',
    );
    expect(unsplit).not.toBe(CI);
    expect(faults(unsplit)).toEqual([
      'the step Coverage of the shard takes no --shard of the matrix cell',
    ]);
    const renamed = CI.replace(/(shard \$\{\{ matrix\.shard \}\})\/3\)/, '$1/2)');
    expect(renamed).not.toBe(CI);
    expect(faults(renamed)).toEqual([
      'the name of the job test ends in /2 and the steps split by 3',
    ]);
  });

  it('is red for a step that splits by another count, and for a merge that counts nothing', () => {
    const other = CI.replace(
      /(--shard=\$\{\{ matrix\.shard \}\})\/3 --reporter=json/,
      '$1/4 --reporter=json',
    );
    expect(other).not.toBe(CI);
    expect(faults(other)[0]).toBe('the steps split the suite by different counts: 4, 3');
    const uncounted = CI.replace('if [ "$found" != \'3\' ]', 'if false');
    expect(uncounted).not.toBe(CI);
    expect(faults(uncounted)).toEqual([
      'the coverage gate does not check that it was handed 3 blobs',
    ]);
    const unwaiting = CI.replace('    needs: [changes, test]\n    runs-on', '    runs-on');
    expect(unwaiting).not.toBe(CI);
    expect(faults(unwaiting)).toEqual(['the coverage gate does not wait for the test job']);

    const lowered = CI.replace(
      'run: pnpm exec vitest --merge-reports=vitest-blob --coverage',
      'run: pnpm exec vitest --merge-reports=vitest-blob --coverage --coverage.thresholds.lines=0',
    );
    expect(lowered).not.toBe(CI);
    expect(faults(lowered)).toEqual([
      'the merge step of the coverage gate carries a --coverage.thresholds flag, which turns the gate off',
    ]);
    const gated = (at: string, line: string): string => {
      const mutated = CI.replace(at, `${at}${line}`);
      expect(mutated).not.toBe(CI);
      return mutated;
    };
    expect(
      faults(gated('      - name: Coverage of the shard\n', '        continue-on-error: true\n')),
    ).toEqual(['the step Coverage of the shard has continue-on-error, so a red suite passes']);
    expect(
      faults(gated('      - name: Count the blobs\n', '        continue-on-error: true\n')),
    ).toEqual([
      'the step Count the blobs of the coverage gate has continue-on-error, so the gate passes without a verdict',
    ]);
    expect(
      faults(
        gated(
          '      - name: Merge the shards and check the thresholds\n',
          '        continue-on-error: true\n',
        ),
      ),
    ).toEqual([
      'the step Merge the shards and check the thresholds of the coverage gate has continue-on-error, so the gate passes without a verdict',
    ]);
    expect(faults(gated('    name: the coverage gate\n', '    continue-on-error: true\n'))).toEqual(
      [
        'the job the-coverage-gate has continue-on-error, so a gate that fails does not fail the run',
      ],
    );
  });
});
