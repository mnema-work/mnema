// @plants-damage
/**
 * `mnema rules test` over a record whose line does not read: the gate denies every write there, so
 * a verdict printed off it (`none`, a green) would be false. The verb refuses to judge, exits
 * non-zero and names why, in every state the projection cache can be in.
 */

import {
  appendFileSync,
  mkdirSync,
  readdirSync,
  renameSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  type Answered,
  inEveryCacheState,
  type Planted,
  type TheCase,
} from './support/every-cache-state.js';
import { runMerged } from './support/merged-streams.js';

const mnema = (planted: Planted, args: string[]) =>
  runMerged(args, {
    cwd: planted.repo,
    timeout: 60_000,
    env: { PATH: process.env.PATH ?? '', HOME: planted.home, GIT_CONFIG_NOSYSTEM: '1' },
  });

type Damage = (segment: string) => void;

function theCase(damaged: Damage): TheCase<Planted> {
  return {
    found(dir) {
      const planted = { repo: join(dir, 'repo'), home: join(dir, 'home') };
      for (const path of [planted.repo, planted.home]) mkdirSync(path, { recursive: true });
      expect(mnema(planted, ['init', '--yes', '--hosts', 'none']).status).toBe(0);
      const said = mnema(planted, ['decision', 'record', 'Never edit billing', 'because']);
      const id = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/.exec(
        said.stdout,
      )?.[1] as string;
      expect(mnema(planted, ['decision', 'move', 'accept', id, '--note', 'agreed']).status).toBe(0);
      mkdirSync(join(planted.repo, 'src', 'billing'), { recursive: true });
      expect(
        mnema(planted, ['link', id, 'src/billing', '--rel', 'refuses-a-write']).status,
      ).toBe(0);
      writeFileSync(
        join(planted.repo, 'cases.json'),
        JSON.stringify({ cases: [{ path: 'src/billing/a.ts', expect: 'refuse' }] }),
      );
      return planted;
    },
    damage(planted) {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 40);
      const tails = join(planted.repo, '.mnema', 'tails');
      const segment = join(tails, readdirSync(tails)[0] as string, '000001.jsonl');
      damaged(segment);
    },
    run(planted, ctx): Answered {
      ctx.forget();
      const ran = mnema(planted, ['rules', 'test', 'cases.json']);
      return { status: ran.status, stdout: ran.stdout, stderr: '' };
    },
    normalize: (said) =>
      said
        .replace(/[0-9a-f]{64}-[0-9a-f]{32}/g, '<tail>')
        .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, '<id>'),
  };
}

const DAMAGES: [string, Damage][] = [
  ['a line that does not read', (segment) => appendFileSync(segment, '{this line does not read\n')],
  [
    'a segment that is a symbolic link',
    (segment) => {
      renameSync(segment, `${segment}.real`);
      symlinkSync(`${segment}.real`, segment);
    },
  ],
];

describe.each(DAMAGES)('rules test over %s, in every state of the cache', (_name, how) => {
  it('refuses to judge and exits non-zero, never printing a verdict', () => {
    const seen = inEveryCacheState(theCase(how));
    for (const state of [seen.warm, seen.cold, seen.session]) {
      expect(state.status, state.state).not.toBe(0);
      expect(state.said, state.state).toContain('RECORD_CANNOT_BE_JUDGED');
      expect(state.said, state.state).not.toContain('MATCH');
    }
    expect(seen.warm.said).toBe(seen.cold.said);
  }, 240_000);
});
