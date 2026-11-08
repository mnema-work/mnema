import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

import { closeSecondReaderSession, pythonAlone, pythonRun } from './second-reader-session.js';

/**
 * ONE python3 FOR MANY READINGS ANSWERS WHAT A python3 OF ITS OWN ANSWERS. The seam the
 * second-reader suites share runs the verifier's two scripts in a long-lived process; this is
 * the proof that doing so changes no answer: the same request, both ways, byte for byte (the
 * exit code, stdout and stderr). A sample runs on every pull request; `SECOND_READER_ALL=1`
 * runs every mutation the tool offers.
 */

const VERIFIER = fileURLToPath(new URL('../../verifier/mnema_verify.py', import.meta.url));
const MUTATE = fileURLToPath(new URL('../../verifier/mutate.py', import.meta.url));
const FIXTURE = fileURLToPath(new URL('./__fixtures__/witnessed-record', import.meta.url));

const scratch: string[] = [];
afterAll(() => {
  closeSecondReaderSession();
  for (const dir of scratch.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function copy(): string {
  const dir = mkdtempSync(join(tmpdir(), 'mnema-session-'));
  scratch.push(dir);
  const record = join(dir, 'record');
  cpSync(FIXTURE, record, { recursive: true });
  return record;
}

const SAMPLE = [
  'edited-event',
  'checkpoint-other-key',
  'keys-removed',
  'blank-segment-same-size',
  'forged-payload-field-appended',
  'byte-order-mark-before-the-first-line',
];

describe('one python3 for many readings answers what a python3 of its own answers', () => {
  const offered = (JSON.parse(pythonAlone('python3', [MUTATE, 'list']).stdout) as string[]).sort();
  const names = process.env.SECOND_READER_ALL === '1' ? offered : SAMPLE;

  it('offers the sampled mutations', () => {
    for (const name of SAMPLE) expect(offered).toContain(name);
  });

  it.each(names)('builds %s and reads it with the same answer both ways', (name) => {
    const [aloneRecord, togetherRecord] = [copy(), copy()];
    const mutatedAlone = pythonAlone('python3', [MUTATE, name, aloneRecord]);
    const mutatedTogether = pythonRun('python3', [MUTATE, name, togetherRecord]);
    expect(mutatedTogether.status).toBe(mutatedAlone.status);
    expect(mutatedTogether.stderr).toBe(mutatedAlone.stderr);
    expect(mutatedTogether.stdout.split(togetherRecord).join('R')).toBe(
      mutatedAlone.stdout.split(aloneRecord).join('R'),
    );

    for (const flags of [['--json'], []]) {
      const alone = pythonAlone('python3', [VERIFIER, ...flags, 'record', aloneRecord]);
      const together = pythonRun('python3', [VERIFIER, ...flags, 'record', togetherRecord]);
      expect(alone.stdout).not.toBe('');
      expect(together.status).toBe(alone.status);
      expect(together.stderr).toBe(alone.stderr);
      expect(together.stdout.split(togetherRecord).join('R')).toBe(
        alone.stdout.split(aloneRecord).join('R'),
      );
    }
  });

  it.each([
    [['--json', 'self-test']],
    [['--json', 'vectors']],
    [['gaps']],
    [['--json', 'gaps']],
    [['--json', 'all']],
    [['record', '/no/such/record']],
    [['--json', 'record', '/no/such/record']],
    [['not-a-command']],
    [[]],
  ])('answers %j with the same exit, stdout and stderr both ways', (args) => {
    const together = pythonRun('python3', [VERIFIER, ...args]);
    const alone = pythonAlone('python3', [VERIFIER, ...args]);
    expect(together.status).toBe(alone.status);
    expect(together.stderr).toBe(alone.stderr);
    expect(together.stdout).toBe(alone.stdout);
  });

  it('answers a request the mutation tool refuses with the same exit and words', () => {
    for (const args of [['no-such-mutation', '/tmp'], ['list'], []]) {
      const together = pythonRun('python3', [MUTATE, ...args]);
      const alone = pythonAlone('python3', [MUTATE, ...args]);
      expect(together.status).toBe(alone.status);
      expect(together.stderr).toBe(alone.stderr);
      expect(together.stdout).toBe(alone.stdout);
    }
  });

  it('leaves what is not the verifier to a python3 of its own', () => {
    expect(pythonRun('python3', ['-c', 'print(1+1)']).stdout).toBe('2\n');
    expect(pythonRun('python3', ['--version']).stdout).toBe(
      pythonAlone('python3', ['--version']).stdout,
    );
  });
});
