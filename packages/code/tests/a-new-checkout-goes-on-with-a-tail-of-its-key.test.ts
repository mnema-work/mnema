// @plants-damage
/**
 * A write that cannot go on with the tail its hint names goes on with another tail of its key when
 * one ends here where this machine left it, and founds a tail only when none does (ADR-445, ADR-446).
 *
 * THE DEFECT, MEASURED ON THE BINARY. A checkout that went back and forth between two branches
 * founded a tail at every visit (six visits, six tails), a new worktree always founded one, and a
 * clone founded one without saying why. Each tail is a file set that every later `verify` and every
 * write that cites the heads of the others has to carry.
 *
 * WHAT STAYS. A tail is never appended to where it does not end at the entry this machine wrote last,
 * and a tail whose end only some branch holds is not taken by another worktree (ADR-446): two branches
 * then never write one tail file past the point they share, which a squash merge on a host with no
 * merge driver cannot settle (the case that squashes one branch and merges the other, with no driver).
 */

import { execFile, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GIT_WITHOUT_MAINTENANCE } from './support/git-without-maintenance.js';
import { MNEMA_CLI } from './support/the-cli.js';

const run = promisify(execFile);

let sandbox: string;
let home: string;
let repo: string;
let origin: string;

const ENV = () => ({
  PATH: process.env.PATH ?? '',
  HOME: home,
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_CONFIG_GLOBAL: GIT_WITHOUT_MAINTENANCE,
  GIT_AUTHOR_NAME: 'a',
  GIT_AUTHOR_EMAIL: 'a@example.invalid',
  GIT_COMMITTER_NAME: 'a',
  GIT_COMMITTER_EMAIL: 'a@example.invalid',
});

function mnema(cwd: string, ...argv: string[]) {
  const ran = spawnSync(process.execPath, [MNEMA_CLI, ...argv], {
    cwd,
    encoding: 'utf-8',
    env: ENV(),
  });
  return { status: ran.status, out: `${ran.stdout}${ran.stderr}`, err: ran.stderr ?? '' };
}

function git(cwd: string, ...args: string[]) {
  const ran = spawnSync('git', args, { cwd, encoding: 'utf-8', env: ENV() });
  return { status: ran.status, out: `${ran.stdout}${ran.stderr}` };
}

const tails = (of: string): string[] => readdirSync(join(of, '.mnema', 'tails')).sort();

/** How many sentences about a new tail a write said. */
const sentences = (out: string): string[] =>
  out.split('\n').filter((line) => line.startsWith('mnema: wrote to a new tail'));

function commit(at: string, message: string): void {
  expect(git(at, 'add', '.mnema').status).toBe(0);
  expect(git(at, 'commit', '-qm', message, '--allow-empty').status).toBe(0);
}

/** `origin` is a bare repository holding `main`, as a host does, and the clone knows its default branch. */
function publishMain(): void {
  expect(git(sandbox, 'init', '-q', '--bare', '-b', 'main', origin).status).toBe(0);
  expect(git(repo, 'remote', 'add', 'origin', origin).status).toBe(0);
  expect(git(repo, 'push', '-q', 'origin', 'main').status).toBe(0);
  expect(git(repo, 'remote', 'set-head', 'origin', 'main').status).toBe(0);
}

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'mnema-a-key-goes-on-'));
  home = join(sandbox, 'home');
  repo = join(sandbox, 'repo');
  origin = join(sandbox, 'origin.git');
  mkdirSync(home);
  mkdirSync(repo);
  expect(git(repo, 'init', '-q', '-b', 'main').status).toBe(0);
  expect(mnema(repo, 'init').status).toBe(0);
  for (const note of ['one', 'two', 'three']) {
    expect(mnema(repo, 'memory', `the base ${note}`).status).toBe(0);
  }
  commit(repo, 'the base');
});

afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

describe('a checkout that goes back and forth between two branches', () => {
  it('writes two tails over six visits and not six, says why once, and both readers verify', () => {
    publishMain();
    expect(git(repo, 'branch', 'a').status).toBe(0);
    expect(git(repo, 'branch', 'b').status).toBe(0);

    const said: string[] = [];
    for (let visit = 1; visit <= 6; visit += 1) {
      const branch = visit % 2 === 1 ? 'a' : 'b';
      expect(git(repo, 'switch', '-q', branch).status).toBe(0);
      const wrote = mnema(repo, 'memory', `visit ${visit}`);
      expect(wrote.status, wrote.out).toBe(0);
      said.push(...sentences(wrote.out));
      commit(repo, `visit ${visit}`);
    }

    expect(git(repo, 'switch', '-q', 'main').status).toBe(0);
    expect(git(repo, 'merge', '-q', 'a', '-m', 'a').status).toBe(0);
    const merged = git(repo, 'merge', '-q', 'b', '-m', 'b');
    expect(merged.status, merged.out).toBe(0);
    expect(tails(repo)).toHaveLength(2);
    expect(said).toHaveLength(1);
    const verified = mnema(repo, 'verify');
    expect(verified.status, verified.out).toBe(0);
    expect(verified.out).toContain('2 tail(s)');
  });
});

describe('a worktree and a clone', () => {
  it('writes its own tail while the worktree that holds the tail exists, says so, and goes on with a tail a removed worktree wrote once it is on the base branch', () => {
    publishMain();
    const wt1 = join(sandbox, 'wt1');
    const wt2 = join(sandbox, 'wt2');
    expect(git(repo, 'worktree', 'add', '-q', wt1, '-b', 'b1').status).toBe(0);
    expect(git(repo, 'worktree', 'add', '-q', wt2, '-b', 'b2').status).toBe(0);

    const first = mnema(wt1, 'memory', 'from the first worktree');
    const second = mnema(wt2, 'memory', 'from the second worktree');
    expect(sentences(first.out)).toHaveLength(1);
    expect(first.out).toContain('are the ones other worktrees write');
    expect(sentences(second.out)).toHaveLength(1);
    expect(mnema(repo, 'memory', 'from the main one').status).toBe(0);
    expect(tails(repo)).toHaveLength(1);
    expect(tails(wt1)).toHaveLength(2);
    expect(tails(wt2)).toHaveLength(2);

    for (const [at, name] of [
      [wt1, 'one'],
      [wt2, 'two'],
      [repo, 'main'],
    ] as const) {
      commit(at, name);
    }
    expect(git(repo, 'merge', '-q', 'b1', '-m', 'b1').status).toBe(0);
    expect(git(repo, 'merge', '-q', 'b2', '-m', 'b2').status).toBe(0);
    expect(git(repo, 'push', '-q', 'origin', 'main').status).toBe(0);
    expect(git(repo, 'worktree', 'remove', '--force', wt1).status).toBe(0);
    expect(git(repo, 'worktree', 'remove', '--force', wt2).status).toBe(0);
    expect(tails(repo)).toHaveLength(3);

    const wt3 = join(sandbox, 'wt3');
    expect(git(repo, 'worktree', 'add', '-q', wt3, '-b', 'b3', 'main').status).toBe(0);
    const third = mnema(wt3, 'memory', 'from the third worktree');
    expect(third.status, third.out).toBe(0);
    expect(sentences(third.out)).toEqual([]);
    expect(tails(wt3)).toHaveLength(3);
    const verified = mnema(wt3, 'verify');
    expect(verified.status, verified.out).toBe(0);
  });

  it('opens a tail in a new clone, says this repository holds no note of writing any tail of the key, and says it once', () => {
    const clone = join(sandbox, 'clone');
    expect(git(sandbox, 'clone', '-q', repo, clone).status).toBe(0);

    const first = mnema(clone, 'memory', 'the first note of the clone');
    expect(first.status, first.out).toBe(0);
    expect(sentences(first.out)).toHaveLength(1);
    expect(first.out).toContain(
      'this repository holds no note of this machine writing any of them',
    );
    expect(tails(clone)).toHaveLength(2);

    const second = mnema(clone, 'memory', 'the second note of the clone');
    expect(second.status, second.out).toBe(0);
    expect(sentences(second.out)).toEqual([]);
    expect(tails(clone)).toHaveLength(2);
  });
});

describe('a tail only some branch holds (ADR-446)', () => {
  it('is not taken by another worktree, so squashing one branch and merging the other conflicts on no tail file, with no merge driver', () => {
    publishMain();
    const wt1 = join(sandbox, 'wt1');
    expect(git(repo, 'worktree', 'add', '-q', wt1, '-b', 'b1').status).toBe(0);
    expect(mnema(wt1, 'memory', 'written on the first branch').status).toBe(0);
    commit(wt1, 'first branch');
    expect(git(repo, 'worktree', 'remove', '--force', wt1).status).toBe(0);

    // The second worktree starts from the first branch, which the host has not merged.
    const wt2 = join(sandbox, 'wt2');
    expect(git(repo, 'worktree', 'add', '-q', wt2, '-b', 'b2', 'b1').status).toBe(0);
    const wrote = mnema(wt2, 'memory', 'written on the second branch');
    expect(wrote.status, wrote.out).toBe(0);
    expect(sentences(wrote.out)).toHaveLength(1);
    expect(tails(wt2)).toHaveLength(3);
    commit(wt2, 'second branch');

    // The host squash-merges the first branch, then the second is merged.
    expect(git(repo, 'merge', '--squash', 'b1').status).toBe(0);
    commit(repo, 'squash of the first branch');
    const merged = git(repo, 'merge', 'b2', '-m', 'the second branch');
    expect(merged.out).not.toContain('CONFLICT');
    expect(merged.status, merged.out).toBe(0);
    const verified = mnema(repo, 'verify');
    expect(verified.status, verified.out).toBe(0);
    expect(tails(repo)).toHaveLength(3);
  });
});

describe('worktrees writing at the same time', () => {
  it('leave no line between lines and no tail two branches wrote, and their branches merge with no driver', async () => {
    publishMain();
    const wt1 = join(sandbox, 'wt1');
    const wt2 = join(sandbox, 'wt2');
    expect(git(repo, 'worktree', 'add', '-q', wt1, '-b', 'b1').status).toBe(0);
    expect(git(repo, 'worktree', 'add', '-q', wt2, '-b', 'b2').status).toBe(0);

    const writes = [repo, wt1, wt2].flatMap((at) =>
      [1, 2, 3, 4].map((n) =>
        run(process.execPath, [MNEMA_CLI, 'memory', `${at}:${n}`], { cwd: at, env: ENV() }),
      ),
    );
    await Promise.all(writes);

    commit(wt1, 'one');
    commit(wt2, 'two');
    commit(repo, 'main');
    expect(git(repo, 'merge', '-q', 'b1', '-m', 'b1').status).toBe(0);
    const merged = git(repo, 'merge', '-q', 'b2', '-m', 'b2');
    expect(merged.status, merged.out).toBe(0);
    const verified = mnema(repo, 'verify');
    expect(verified.status, verified.out).toBe(0);
    expect(tails(repo)).toHaveLength(3);
  }, 60_000);
});
