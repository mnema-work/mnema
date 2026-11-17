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
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { inEveryCacheState, type Planted } from './support/every-cache-state.js';
import { MNEMA_CLI } from './support/the-cli.js';

const VERIFIER = fileURLToPath(new URL('../../chain/verifier/mnema_verify.py', import.meta.url));

const whole = (path: string) => readFileSync(path, 'utf-8');

function mnema(planted: Planted, args: string[]) {
  return spawnSync(process.execPath, [MNEMA_CLI, ...args], {
    cwd: planted.repo,
    encoding: 'utf-8',
    env: { PATH: process.env.PATH ?? '', HOME: planted.home, GIT_CONFIG_NOSYSTEM: '1' },
  });
}

function proofOf(planted: Planted): string {
  const tails = join(planted.repo, '.mnema', 'tails');
  const [tail] = readdirSync(tails);
  return join(tails, tail as string, 'tailproof.json');
}

/** A tail with one fact, its proof damaged by `damage`, then one more write, then both readers. */
function afterTheCut(damage: (good: string) => string, expectRewritten: boolean) {
  let good = '';
  let damaged = '';
  inEveryCacheState<Planted>({
    found(dir) {
      const planted = { repo: join(dir, 'repo'), home: join(dir, 'home') };
      for (const path of [planted.repo, planted.home]) mkdirSync(path, { recursive: true });
      expect(mnema(planted, ['init', '--yes', '--hosts', 'none']).status).toBe(0);
      expect(mnema(planted, ['memory', 'the first fact']).status).toBe(0);
      return planted;
    },
    damage(planted) {
      good = whole(proofOf(planted));
      damaged = damage(good);
      writeFileSync(proofOf(planted), damaged);
    },
    run(planted) {
      expect(mnema(planted, ['memory', 'the fact after the cut']).status).toBe(0);
      expect(whole(proofOf(planted))).toBe(expectRewritten ? good : damaged);
      const verified = mnema(planted, ['verify']);
      if (expectRewritten) {
        expect(verified.status, `${verified.stdout}${verified.stderr}`).toBe(0);
        const second = spawnSync(
          'python3',
          ['-I', VERIFIER, 'record', join(planted.repo, '.mnema')],
          { encoding: 'utf-8' },
        );
        expect(second.status, second.stdout).toBe(0);
      }
      return verified;
    },
    normalize: (said) => said.replace(/[0-9a-f]{12,64}/g, '<id>'),
  });
}

describe('a tail whose proof a power cut left unreadable', () => {
  for (const [state, damage] of [
    ['empty', () => ''],
    ['cut at 200 bytes', (text: string) => text.slice(0, 200)],
    ['holding bytes that are not JSON', () => 'not a proof\n'],
  ] as const) {
    it(`${state}: the next write gives it back its proof, and both readers verify`, () => {
      afterTheCut(damage, true);
    }, 120_000);
  }

  it('that parses and names another record is left as it is', () => {
    afterTheCut(
      (text) => text.replace(/"record":"[0-9a-f]{64}"/, `"record":"${'ab'.repeat(32)}"`),
      false,
    );
  }, 120_000);
});
