/**
 * A POWER CUT AT A TAIL'S BIRTH LEAVES A PROOF THE NEXT WRITE REWRITES (ADR-354): the built
 * binary, a tail whose `tailproof.json` is left empty or cut short, then one more write.
 *
 * WHAT WAS WRONG. The writer gave a tail its proof only when the file was absent. A file that
 * existed and did not read, which is what a power cut between the file's creation and its bytes
 * leaves, was never replaced: every write after it passed in silence and both readers refused the
 * tail for good.
 *
 * WHAT HOLDS NOW. A proof that is empty or does not parse is written again by the next write, and
 * both readers verify. A proof that parses is never touched, even where it names another record:
 * what the readers say of it is theirs to say.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { MNEMA_CLI } from './support/the-cli.js';

const VERIFIER = fileURLToPath(new URL('../../chain/verifier/mnema_verify.py', import.meta.url));

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const whole = (path: string) => readFileSync(path, 'utf-8');

function project() {
  const dir = mkdtempSync(join(tmpdir(), 'mnema-proof-'));
  dirs.push(dir);
  const repo = join(dir, 'repo');
  const home = join(dir, 'home');
  for (const path of [repo, home]) mkdirSync(path);
  const run = (args: string[]) =>
    spawnSync(process.execPath, [MNEMA_CLI, ...args], {
      cwd: repo,
      encoding: 'utf-8',
      env: { PATH: process.env.PATH ?? '', HOME: home, GIT_CONFIG_NOSYSTEM: '1' },
    });
  expect(run(['init', '--yes', '--hosts', 'none']).status).toBe(0);
  expect(run(['memory', 'the first fact']).status).toBe(0);
  const tails = join(repo, '.mnema', 'tails');
  const [tail] = readdirSync(tails);
  const proof = join(tails, tail as string, 'tailproof.json');
  const python = () =>
    spawnSync('python3', ['-I', VERIFIER, 'record', join(repo, '.mnema')], { encoding: 'utf-8' });
  return { run, proof, python, tails };
}

describe('a tail whose proof a power cut left unreadable', () => {
  for (const [state, damage] of [
    ['empty', () => ''],
    ['cut at 200 bytes', (text: string) => text.slice(0, 200)],
    ['holding bytes that are not JSON', () => 'not a proof\n'],
  ] as const) {
    it(`${state}: the next write gives it back its proof, and both readers verify`, () => {
      const { run, proof, python } = project();
      const good = whole(proof);
      writeFileSync(proof, damage(good));
      expect(run(['verify']).status).not.toBe(0);
      expect(python().status).not.toBe(0);

      expect(run(['memory', 'the fact after the cut']).status).toBe(0);

      expect(whole(proof)).toBe(good);
      const verified = run(['verify']);
      expect(verified.status, `${verified.stdout}${verified.stderr}`).toBe(0);
      const second = python();
      expect(second.status, second.stdout).toBe(0);
    });
  }

  it('that parses and names another record is left as it is', () => {
    const { run, proof } = project();
    const foreign = whole(proof).replace(
      /"record":"[0-9a-f]{64}"/,
      `"record":"${'ab'.repeat(32)}"`,
    );
    expect(foreign).not.toBe(whole(proof));
    writeFileSync(proof, foreign);
    run(['memory', 'the fact after the swap']);
    expect(whole(proof)).toBe(foreign);
  });
});
