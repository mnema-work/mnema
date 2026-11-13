/**
 * THE HELPER THAT RUNS A CASE WARM, COLD AND WITH A SESSION OPEN SEEN TO HOLD WHAT IT SAYS.
 *
 * `support/every-cache-state.ts` is what makes an integrity case three cases. A helper that
 * silently ran two of them would read as agreement, so this runs it on a product built here, and
 * on a product that does disagree, and asks of each: which states ran, in what condition, and
 * whether the disagreement is the one that is refused.
 */

import { spawnSync } from 'node:child_process';
import { appendFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { ensureTree } from '@mnema/chain';
import { PROJECT_DIR } from '@mnema/core';
import { describe, expect, it } from 'vitest';
import {
  cacheFilesOf,
  firstLineOf,
  inEveryCacheState,
  type Planted,
  type TheCase,
} from './support/every-cache-state.js';
import { MNEMA_CLI } from './support/the-cli.js';

type Founded = Planted;

/** A real record, founded by the product, with a line nobody can read added to its tail. */
const mnemaRun = (planted: Planted, args: string[]) =>
  spawnSync(process.execPath, [MNEMA_CLI, ...args], {
    cwd: planted.repo,
    encoding: 'utf-8',
    env: { PATH: process.env.PATH ?? '', HOME: planted.home, GIT_CONFIG_NOSYSTEM: '1' },
  });

function aRealCase(): TheCase<Founded> {
  const mnema = mnemaRun;
  return {
    found(dir) {
      const planted = { repo: join(dir, 'repo'), home: join(dir, 'home') };
      for (const path of [planted.repo, planted.home]) mkdirSync(path, { recursive: true });
      expect(mnema(planted, ['init', '--yes', '--hosts', 'none']).status).toBe(0);
      expect(mnema(planted, ['memory', 'one']).status).toBe(0);
      return planted;
    },
    damage(planted) {
      const tails = join(planted.repo, '.mnema', 'tails');
      const [tail] = readdirSync(tails);
      appendFileSync(join(tails, tail as string, '000001.jsonl'), 'a line nobody can read\n');
    },
    run: (planted) => mnema(planted, ['verify']),
  };
}

describe('the three states of the projection cache', () => {
  it('runs a case warm, cold and with a session open before the damage, each in the state it names', () => {
    const asked: string[] = [];
    const seen = inEveryCacheState<Founded>({
      ...aRealCase(),
      run(planted) {
        asked.push(`${cacheFilesOf(planted.repo).length > 0 ? 'cache' : 'no cache'}`);
        return { status: 0, stdout: 'verified\nmore\n', stderr: '' };
      },
    });
    expect(asked).toEqual(['cache', 'no cache', 'cache']);
    expect(Object.keys(seen)).toEqual(['warm', 'cold', 'session']);
    expect(seen.warm.cacheWhenAsked).toBe(true);
    expect(seen.cold.cacheWhenAsked).toBe(false);
    expect(seen.session.sessionOpenAtDamage).toBe(true);
    expect(seen.warm.sessionOpenAtDamage).toBe(false);
    expect(seen.cold.firstLine).toBe('verified');
  }, 90_000);

  it('answers alike on a real record the binary judges', () => {
    const seen = inEveryCacheState(aRealCase());
    expect(seen.warm.status).toBe(1);
    expect(seen.cold.firstLine).toBe(seen.warm.firstLine);
    expect(seen.session.firstLine).toBe(seen.warm.firstLine);
  }, 90_000);

  it('refuses a product that answers one thing with the cache and another without it (the helper seen to fire)', () => {
    const lying: TheCase<Founded> = {
      ...aRealCase(),
      run: (planted) =>
        cacheFilesOf(planted.repo).length > 0
          ? { status: 0, stdout: 'verified\n', stderr: '' }
          : { status: 1, stdout: 'verified\n', stderr: '' },
    };
    expect(() => inEveryCacheState(lying)).toThrow(/exit: cold against warm/);
    const worded: TheCase<Founded> = {
      ...aRealCase(),
      run: (planted) => ({
        status: 1,
        stdout: cacheFilesOf(planted.repo).length > 0 ? 'refused: a\n' : 'refused: b\n',
        stderr: '',
      }),
    };
    expect(() => inEveryCacheState(worded)).toThrow(/first line: cold against warm/);
  }, 90_000);

  it('accuses a case whose record the last write left no cache beside, so warm would not be warm', () => {
    const base = aRealCase();
    const bare: TheCase<Founded> = {
      ...base,
      found(dir) {
        const planted = base.found(dir);
        for (const file of cacheFilesOf(planted.repo)) rmSync(file);
        return planted;
      },
    };
    expect(() => inEveryCacheState(bare)).toThrow(/left none/);
  }, 90_000);

  it('opens the session before the damage, asks it, and gives it to run in the session state only', () => {
    const given: Record<string, boolean> = {};
    const seen = inEveryCacheState<Founded>({
      ...aRealCase(),
      workspace(dir) {
        const second = join(dir, 'second-project');
        mkdirSync(second, { recursive: true });
        ensureTree({ root: join(second, PROJECT_DIR) });
        return second;
      },
      run(planted, ctx) {
        given[ctx.state] = ctx.session !== undefined;
        if (ctx.session) expect(ctx.session.workspaceProjects.length).toBeGreaterThan(1);
        return mnemaRun(planted, ['verify']);
      },
    });
    expect(given).toEqual({ warm: false, cold: false, session: true });
    expect(seen.session.session?.before).toMatch(/^ok /);
    expect(seen.session.session?.after).toBe(seen.session.session?.fresh);
    expect(seen.warm.session).toBeUndefined();
  }, 90_000);

  it('forgets the cache before each answer in the cold state and in no other', () => {
    const present: string[] = [];
    inEveryCacheState<Founded>({
      ...aRealCase(),
      // Nothing is damaged here: a write on an intact record is what leaves a cache behind.
      damage: () => undefined,
      run(planted, ctx) {
        for (let answer = 0; answer < 2; answer++) {
          mnemaRun(planted, ['memory', `an answer that leaves a cache ${answer}`]);
          ctx.forget();
          present.push(`${ctx.state}:${cacheFilesOf(planted.repo).length > 0}`);
        }
        return mnemaRun(planted, ['verify']);
      },
    });
    expect(present).toEqual([
      'warm:true',
      'warm:true',
      'cold:false',
      'cold:false',
      'session:true',
      'session:true',
    ]);
  }, 90_000);

  it('takes the first line as the first one that says something', () => {
    expect(firstLineOf('\n  \nrefused: x\nsecond\n')).toBe('refused: x');
    expect(firstLineOf('')).toBe('');
  });
});
