// @plants-damage
/**
 * The adapter behind `mnema tail repair`: which tree it serves, what it asks git, and what it hands
 * back. What a line must prove to be put back is `repairTail`'s (`@mnema/chain`) and the binary's
 * cases are `tests/a-line-is-repaired-from-git.test.ts`; these are the two things only this adapter
 * decides: that only the committed public tree is served, and that the revision is read from git.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveTrees } from '@mnema/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GIT_WITHOUT_MAINTENANCE } from '../../tests/support/git-without-maintenance.js';
import { runInit } from './init.js';
import { runTailRepair } from './tail-repair.js';

let sandbox: string;
let repo: string;
let env: { home: string };

const processEnv = (): NodeJS.ProcessEnv => ({
  PATH: process.env.PATH ?? '',
  HOME: env.home,
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_CONFIG_GLOBAL: GIT_WITHOUT_MAINTENANCE,
  GIT_AUTHOR_NAME: 'T',
  GIT_AUTHOR_EMAIL: 't@example.com',
  GIT_COMMITTER_NAME: 'T',
  GIT_COMMITTER_EMAIL: 't@example.com',
});

function git(...args: string[]): void {
  const ran = spawnSync('git', args, {
    cwd: repo,
    encoding: 'utf-8',
    env: { ...processEnv(), GIT_CONFIG_GLOBAL: GIT_WITHOUT_MAINTENANCE },
  });
  expect(ran.status, ran.stderr).toBe(0);
}

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'mnema-tail-repair-'));
  repo = join(sandbox, 'repo');
  env = { home: join(sandbox, 'home') };
  mkdirSync(repo, { recursive: true });
  git('init', '-q', '-b', 'main');
  runInit({ cwd: repo, env });
});

afterEach(() => rmSync(sandbox, { recursive: true, force: true }));

const publicTail = (): string =>
  readdirSync(join(resolveTrees(repo, env).projectPublic as string, 'tails'))[0] as string;
const segmentOf = (): string =>
  join(resolveTrees(repo, env).projectPublic as string, 'tails', publicTail(), '000001.jsonl');
const ctx = () => ({ cwd: repo, env, processEnv: processEnv() });

describe('runTailRepair', () => {
  it('refuses where there is no project, and for a tail no tree holds', () => {
    expect(runTailRepair({ cwd: sandbox, env, processEnv: processEnv() }, { tail: 'x' })).toEqual({
      ok: false,
      reason: 'NO_PROJECT',
    });
    expect(runTailRepair(ctx(), { tail: 'nothing' })).toEqual({
      ok: false,
      reason: 'UNKNOWN_TAIL',
    });
  });

  it('refuses a tail of the global tree, which git does not keep, and writes nothing', () => {
    const global = resolveTrees(repo, env).global;
    const tails = join(global, 'tails');
    mkdirSync(join(tails, 'a-global-tail'), { recursive: true });
    expect(runTailRepair(ctx(), { tail: 'a-global-tail' })).toEqual({
      ok: false,
      reason: 'NOT_THE_PUBLIC_TREE',
      tree: 'this machine’s global record',
    });
    expect(readdirSync(join(tails, 'a-global-tail'))).toEqual([]);
  });

  it('refuses a revision that is not a commit of the repository, or is an option', () => {
    git('add', '.mnema');
    git('commit', '-q', '-m', 'the record');
    expect(runTailRepair(ctx(), { tail: publicTail(), from: 'no-such' })).toEqual({
      ok: false,
      reason: 'NO_SUCH_REVISION',
      from: 'no-such',
    });
    expect(runTailRepair(ctx(), { tail: publicTail(), from: '--help' })).toEqual({
      ok: false,
      reason: 'NO_SUCH_REVISION',
      from: '--help',
    });
  });

  it('reads the line from the revision and puts it back, saying which line and why', () => {
    git('add', '.mnema');
    git('commit', '-q', '-m', 'the record');
    const honest = readFileSync(segmentOf());
    const lines = honest.toString('latin1').split('\n');
    lines[0] = `\0${(lines[0] as string).slice(1)}`;
    writeFileSync(segmentOf(), lines.join('\n'), 'latin1');
    const done = runTailRepair(ctx(), { tail: publicTail() });
    expect(done).toMatchObject({
      ok: true,
      from: 'HEAD',
      repaired: [{ segment: '000001.jsonl', line: 1, seq: 0, was: 'unreadable' }],
    });
    expect(readFileSync(segmentOf()).equals(honest)).toBe(true);
  });

  it('says a record that is not in a repository has no line to put back', () => {
    rmSync(join(repo, '.git'), { recursive: true, force: true });
    expect(runTailRepair(ctx(), { tail: publicTail() })).toEqual({
      ok: false,
      reason: 'NOT_A_REPOSITORY',
    });
  });
});
