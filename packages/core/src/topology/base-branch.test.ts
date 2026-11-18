// @plants-damage
/**
 * Whether an entry of a tail is already on the base branch: the question the write asks of a tail it
 * could go on with (ADR-446). A repository is built with git's plumbing, so no commit starts
 * maintenance, and the base branch is the remote-tracking ref the clone holds.
 */

import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { branchOfWorktree, entryIsOnTheBase, tailIsHeldOnlyBy } from './base-branch.js';

const ON_BASE = 'a'.repeat(64);
const ELSEWHERE = 'b'.repeat(64);
const AS_PREV = 'e'.repeat(64);
const TAIL = `${'c'.repeat(64)}-${'1'.repeat(32)}`;

let sandbox: string;
let repo: string;

function git(...args: string[]): string {
  const ran = spawnSync('git', args, {
    cwd: repo,
    encoding: 'utf-8',
    env: {
      PATH: process.env.PATH ?? '',
      HOME: sandbox,
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_CONFIG_GLOBAL: '/dev/null',
      GIT_AUTHOR_NAME: 'a',
      GIT_AUTHOR_EMAIL: 'a@example.invalid',
      GIT_COMMITTER_NAME: 'a',
      GIT_COMMITTER_EMAIL: 'a@example.invalid',
    },
  });
  expect(ran.status, `${args.join(' ')}: ${ran.stderr}`).toBe(0);
  return ran.stdout.trim();
}

/** A commit holding `.mnema/tails/<tail>/000001.jsonl` with `line`, made with plumbing, and the ref that names it. */
function theBaseHolds(line: string, ref: string): void {
  const written = spawnSync('git', ['hash-object', '-w', '--stdin'], {
    cwd: repo,
    input: `${line}\n`,
    encoding: 'utf-8',
  }).stdout.trim();
  git(
    'update-index',
    '--add',
    '--cacheinfo',
    `100644,${written},.mnema/tails/${TAIL}/000001.jsonl`,
  );
  const commit = git('commit-tree', '-m', 'base', git('write-tree'));
  git('update-ref', ref, commit);
}

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'mnema-base-branch-'));
  repo = join(sandbox, 'repo');
  mkdirSync(join(repo, '.mnema'), { recursive: true });
  git('init', '-q', '-b', 'main');
});

afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

describe('an entry on the base branch', () => {
  it('is one the segment of that tail holds on the remote’s default branch, and no other', () => {
    git('remote', 'add', 'origin', join(sandbox, 'nowhere.git'));
    theBaseHolds(
      `{"link":{"seq":4,"hash":"${ON_BASE}"}}\n{"link":{"seq":5,"prev":"${AS_PREV}","hash":"${'d'.repeat(64)}"}}`,
      'refs/remotes/origin/main',
    );
    git('symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/main');

    const onBase = entryIsOnTheBase(repo, join(repo, '.mnema'));
    expect(onBase(TAIL, '000001.jsonl', ON_BASE)).toBe(true);
    expect(onBase(TAIL, '000001.jsonl', ELSEWHERE)).toBe(false);
    // A hash a later line only names as its `prev` is an entry the base branch does not hold.
    expect(onBase(TAIL, '000001.jsonl', AS_PREV)).toBe(false);
    expect(onBase(TAIL, '000002.jsonl', ON_BASE)).toBe(false);
  });

  it('is none where the repository has no remote, or no default branch known to it', () => {
    writeFileSync(join(repo, '.mnema', 'x'), '');
    expect(entryIsOnTheBase(repo, join(repo, '.mnema'))(TAIL, '000001.jsonl', ON_BASE)).toBe(false);
    git('remote', 'add', 'origin', join(sandbox, 'nowhere.git'));
    expect(entryIsOnTheBase(repo, join(repo, '.mnema'))(TAIL, '000001.jsonl', ON_BASE)).toBe(false);
  });
});

describe('the time the questions of one write may take', () => {
  it('is spent once: a git that hangs is stopped, and every question after it is answered at once with no answer', () => {
    git('remote', 'add', 'origin', join(sandbox, 'nowhere.git'));
    theBaseHolds(`{"link":{"seq":4,"hash":"${ON_BASE}"}}`, 'refs/remotes/origin/main');
    git('symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/main');
    const bin = join(sandbox, 'bin');
    mkdirSync(bin);
    writeFileSync(join(bin, 'git'), '#!/bin/sh\nsleep 5\n');
    chmodSync(join(bin, 'git'), 0o755);
    const path = process.env.PATH;
    process.env.PATH = `${bin}:${path}`;
    try {
      const onBase = entryIsOnTheBase(repo, join(repo, '.mnema'), 300);
      expect(onBase(TAIL, '000001.jsonl', ON_BASE)).toBeUndefined();
      const began = Date.now();
      expect(onBase(TAIL, '000001.jsonl', ON_BASE)).toBeUndefined();
      expect(Date.now() - began).toBeLessThan(200);
    } finally {
      process.env.PATH = path;
    }
  });
});

/** Whether this git can keep a repository in the reftable format (2.45 and later). */
const REFTABLE = (() => {
  const ran = spawnSync('git', ['--version'], {
    encoding: 'utf-8',
    env: { PATH: process.env.PATH ?? '', HOME: tmpdir(), GIT_CONFIG_NOSYSTEM: '1' },
  });
  const [major, minor] = (/(\d+)\.(\d+)/.exec(ran.stdout) ?? []).slice(1).map(Number);
  return (major ?? 0) > 2 || ((major ?? 0) === 2 && (minor ?? 0) >= 45);
})();

describe('the branch a worktree has checked out', () => {
  it('is read from HEAD, and is none for a detached HEAD', () => {
    expect(branchOfWorktree(join(repo, '.git'), repo)).toBe('main');
    git('symbolic-ref', 'HEAD', 'refs/heads/feature/x');
    expect(branchOfWorktree(join(repo, '.git'), repo)).toBe('feature/x');
    writeFileSync(join(repo, '.git', 'HEAD'), `${'a'.repeat(40)}\n`);
    expect(branchOfWorktree(join(repo, '.git'), repo)).toBeUndefined();
  });

  // Runs wherever the runner's git is 2.45 or later (the node jobs on Linux); skipped, by name, below that.
  it.skipIf(!REFTABLE)(
    'is asked of git where the repository is kept in the reftable format, whose HEAD file names no branch',
    () => {
      const table = join(sandbox, 'reftable');
      mkdirSync(table);
      const ran = spawnSync('git', ['init', '-q', '--ref-format=reftable', '-b', 'main'], {
        cwd: table,
        encoding: 'utf-8',
        env: {
          PATH: process.env.PATH ?? '',
          HOME: sandbox,
          GIT_CONFIG_NOSYSTEM: '1',
          GIT_CONFIG_GLOBAL: '/dev/null',
        },
      });
      expect(ran.status, ran.stderr).toBe(0);
      expect(readFileSync(join(table, '.git', 'HEAD'), 'utf-8')).toContain('refs/heads/.invalid');
      expect(branchOfWorktree(join(table, '.git'), table)).toBe('main');
      spawnSync('git', ['symbolic-ref', 'HEAD', 'refs/heads/feature/x'], { cwd: table });
      expect(branchOfWorktree(join(table, '.git'), table)).toBe('feature/x');
    },
  );
});

describe('a tail held by one branch alone', () => {
  it('is held by every branch while no commit holds it, and by the one ref that contains the commit that does', () => {
    const asked = tailIsHeldOnlyBy(repo, join(repo, '.mnema'));
    expect(asked(TAIL, 'main')).toBe(true);
    theBaseHolds('{"link":{"seq":1}}', 'refs/heads/main');
    expect(asked(TAIL, 'main')).toBe(true);
    expect(asked(TAIL, 'other')).toBe(false);
    expect(asked(`${'c'.repeat(64)}-${'2'.repeat(32)}`, 'main')).toBe(true);
  });

  it('is not held by one branch alone once a second ref, a remote-tracking one or a tag, contains it', () => {
    theBaseHolds('{"link":{"seq":1}}', 'refs/heads/main');
    const asked = tailIsHeldOnlyBy(repo, join(repo, '.mnema'));
    git('update-ref', 'refs/heads/cut-from-it', 'refs/heads/main');
    expect(asked(TAIL, 'main')).toBe(false);
    git('update-ref', '-d', 'refs/heads/cut-from-it');
    expect(asked(TAIL, 'main')).toBe(true);
    git('update-ref', 'refs/remotes/origin/main', 'refs/heads/main');
    expect(asked(TAIL, 'main')).toBe(false);
    git('update-ref', '-d', 'refs/remotes/origin/main');
    git('update-ref', 'refs/tags/v', 'refs/heads/main');
    expect(asked(TAIL, 'main')).toBe(false);
  });

  it('is not answered where the folder is no repository', () => {
    const outside = join(sandbox, 'plain');
    mkdirSync(join(outside, '.mnema'), { recursive: true });
    expect(tailIsHeldOnlyBy(outside, join(outside, '.mnema'))(TAIL, 'main')).toBeUndefined();
  });
});
