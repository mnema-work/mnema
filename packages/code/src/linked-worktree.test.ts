import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GIT_WITHOUT_MAINTENANCE } from '../tests/support/git-without-maintenance.js';
import {
  noProjectInAWorktree,
  notHereInAWorktree,
  recordOfTheMainCheckout,
} from './linked-worktree.js';

let sandbox: string;
let repo: string;
let worktree: string;

function git(cwd: string, ...args: string[]): void {
  const ran = spawnSync('git', args, {
    cwd,
    encoding: 'utf-8',
    env: {
      PATH: process.env.PATH ?? '',
      HOME: sandbox,
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_CONFIG_GLOBAL: GIT_WITHOUT_MAINTENANCE,
      GIT_AUTHOR_NAME: 'a',
      GIT_AUTHOR_EMAIL: 'a@example.invalid',
      GIT_COMMITTER_NAME: 'a',
      GIT_COMMITTER_EMAIL: 'a@example.invalid',
    },
  });
  expect(ran.status, ran.stderr).toBe(0);
}

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'mnema-linked-worktree-'));
  const real = realpathSync(sandbox);
  repo = join(real, 'repo');
  worktree = join(real, 'wt');
  mkdirSync(repo);
  git(repo, 'init', '-q', '-b', 'main');
  writeFileSync(join(repo, 'README.md'), 'x\n');
  git(repo, 'add', 'README.md');
  git(repo, 'commit', '-qm', 'first');
  git(repo, 'worktree', 'add', '-q', worktree);
});

afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

describe('the main checkout, as a linked worktree sees it', () => {
  it('names the record the main checkout holds, from the top of the worktree and from under it', () => {
    mkdirSync(join(repo, '.mnema'));
    mkdirSync(join(worktree, 'sub'));
    expect(recordOfTheMainCheckout(worktree)).toBe(join(repo, '.mnema'));
    expect(recordOfTheMainCheckout(join(worktree, 'sub'))).toBe(join(repo, '.mnema'));
    expect(noProjectInAWorktree(worktree)).toContain(`the record is at ${join(repo, '.mnema')}`);
  });

  it('finds a record the main checkout holds one folder down, for a project one folder down', () => {
    mkdirSync(join(repo, 'app', '.mnema'), { recursive: true });
    mkdirSync(join(worktree, 'app'));
    expect(recordOfTheMainCheckout(join(worktree, 'app'))).toBe(join(repo, 'app', '.mnema'));
    expect(recordOfTheMainCheckout(worktree)).toBeUndefined();
  });

  it('says nothing about a record the main checkout does not hold, nor in the main checkout itself', () => {
    expect(recordOfTheMainCheckout(worktree)).toBeUndefined();
    expect(noProjectInAWorktree(worktree)).toBeUndefined();
    mkdirSync(join(repo, '.mnema'));
    expect(recordOfTheMainCheckout(repo)).toBeUndefined();
    expect(noProjectInAWorktree(repo)).toBeUndefined();
  });

  it('says nothing outside a repository', () => {
    const outside = mkdtempSync(join(tmpdir(), 'mnema-linked-outside-'));
    try {
      expect(noProjectInAWorktree(outside)).toBeUndefined();
      expect(notHereInAWorktree(outside)).toBeUndefined();
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });

  it('adds the not-yet-committed hint in a worktree only, naming the main checkout', () => {
    expect(notHereInAWorktree(worktree)).toBe(
      `This is a linked worktree: a record written in the main checkout (${repo}) and not yet committed is not here; read it from there.`,
    );
    expect(notHereInAWorktree(repo)).toBeUndefined();
  });
});
