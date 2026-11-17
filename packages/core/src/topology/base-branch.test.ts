/**
 * Whether an entry of a tail is already on the base branch: the question the write asks of a tail it
 * could go on with (ADR-446). A repository is built with git's plumbing, so no commit starts
 * maintenance, and the base branch is the remote-tracking ref the clone holds.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { entryIsOnTheBase } from './base-branch.js';

const ON_BASE = 'a'.repeat(64);
const ELSEWHERE = 'b'.repeat(64);
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
    theBaseHolds(`{"link":{"seq":4,"hash":"${ON_BASE}"}}`, 'refs/remotes/origin/main');
    git('symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/main');

    const onBase = entryIsOnTheBase(repo, join(repo, '.mnema'));
    expect(onBase(TAIL, '000001.jsonl', ON_BASE)).toBe(true);
    expect(onBase(TAIL, '000001.jsonl', ELSEWHERE)).toBe(false);
    expect(onBase(TAIL, '000002.jsonl', ON_BASE)).toBe(false);
  });

  it('is none where the repository has no remote, or no default branch known to it', () => {
    writeFileSync(join(repo, '.mnema', 'x'), '');
    expect(entryIsOnTheBase(repo, join(repo, '.mnema'))(TAIL, '000001.jsonl', ON_BASE)).toBe(false);
    git('remote', 'add', 'origin', join(sandbox, 'nowhere.git'));
    expect(entryIsOnTheBase(repo, join(repo, '.mnema'))(TAIL, '000001.jsonl', ON_BASE)).toBe(false);
  });
});
