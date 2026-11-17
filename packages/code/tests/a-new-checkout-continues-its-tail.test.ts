/**
 * What a tail's notes and lock outlive: the checkout they were written in.
 *
 * THE DEFECT, MEASURED ON THE BINARY. The note of what this machine wrote last to a tail, its
 * lock and the id that names the tail all lived inside the checkout, ignored by git. `git clean
 * -fdX` deleted them and the next write opened a tail of its own, saying nothing: a tail more
 * for every clean, and a worktree of the repository never saw what any other had written.
 *
 * Inside a repository the notes and the lock now live under the common git directory, which every
 * worktree shares and no clean touches, and each worktree keeps a hint of its id under its own git
 * directory. What a reader of the record sees is unchanged.
 */

import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GIT_WITHOUT_MAINTENANCE } from './support/git-without-maintenance.js';
import { MNEMA_CLI } from './support/the-cli.js';

let sandbox: string;
let home: string;
let repo: string;

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

/** Where the notes and the lock of every tail of the project at the top of `repo` live. */
function shared(): string {
  return join(repo, '.git', 'mnema', '%2E', 'public');
}

function tails(of: string = repo): string[] {
  return readdirSync(join(of, '.mnema', 'tails')).sort();
}

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'mnema-a-new-checkout-'));
  home = join(sandbox, 'home');
  repo = join(sandbox, 'repo');
  mkdirSync(home);
  mkdirSync(repo);
  expect(git(repo, 'init', '-q', '-b', 'main').status).toBe(0);
  expect(mnema(repo, 'init').status).toBe(0);
});

afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

describe('where a tail keeps its notes, its lock and its id inside a repository', () => {
  it('puts the notes under the common git directory and the id under this checkout’s own, and nothing of either in .mnema/', () => {
    const wrote = mnema(repo, 'memory', 'the first note');
    expect(wrote.status, wrote.out).toBe(0);
    const [tail] = tails();
    expect(tails()).toHaveLength(1);

    const notes = readdirSync(join(shared(), 'locks'));
    expect(notes).toContain(`${tail}.head`);
    expect(notes).toContain(`${tail}.head.sig`);
    const fingerprint = (tail as string).split('-')[0] as string;
    expect(readFileSync(join(shared(), 'keys', `${fingerprint}.inst`), 'utf-8').trim()).toBe(
      (tail as string).slice(fingerprint.length + 1),
    );

    // The record's own `locks/` holds the projection a reader keeps, and nothing a writer notes.
    const left = existsSync(join(repo, '.mnema', 'locks'))
      ? readdirSync(join(repo, '.mnema', 'locks'))
      : [];
    expect(left.filter((name) => name.startsWith(`${tail}.`))).toEqual([]);
    expect(existsSync(join(repo, '.mnema', 'keys', `${fingerprint}.inst`))).toBe(false);
  }, 120_000);
});

describe('a clean of what git ignores', () => {
  it('goes on writing the same tail, and says nothing', () => {
    expect(mnema(repo, 'memory', 'before the clean').status).toBe(0);
    expect(git(repo, 'add', '.mnema').status).toBe(0);
    expect(git(repo, 'commit', '-qm', 'the record').status).toBe(0);
    const before = tails();

    const cleaned = git(repo, 'clean', '-fdXq');
    expect(cleaned.status, cleaned.out).toBe(0);

    const wrote = mnema(repo, 'memory', 'after the clean');
    expect(wrote.status, wrote.out).toBe(0);
    expect(wrote.out).not.toContain('wrote to a new tail');
    expect(tails()).toEqual(before);
    const verified = mnema(repo, 'verify');
    expect(verified.status, verified.out).toBe(0);
  }, 120_000);
});

describe('a write over a place that holds a symbolic link', () => {
  it('refuses a locks directory that is one, by name, and writes nothing through it', () => {
    expect(mnema(repo, 'memory', 'the first note').status).toBe(0);
    const outside = join(sandbox, 'outside');
    mkdirSync(outside);
    rmSync(join(shared(), 'locks'), { recursive: true });
    symlinkSync(outside, join(shared(), 'locks'), 'dir');

    const wrote = mnema(repo, 'memory', 'through the link');
    expect(wrote.status).not.toBe(0);
    expect(wrote.out).toContain('is a symbolic link');
    expect(wrote.out).toContain(join(shared(), 'locks'));
    expect(readdirSync(outside)).toEqual([]);
  }, 120_000);

  it('refuses a note that is one, and leaves what it points at as it was', () => {
    expect(mnema(repo, 'memory', 'the first note').status).toBe(0);
    const [tail] = tails();
    const target = join(sandbox, 'elsewhere.head');
    writeFileSync(target, 'untouched\n');
    const note = join(shared(), 'locks', `${tail}.head`);
    rmSync(note);
    symlinkSync(target, note);

    const wrote = mnema(repo, 'memory', 'through the note');
    expect(wrote.status).not.toBe(0);
    expect(wrote.out).toContain('is a symbolic link');
    expect(readFileSync(target, 'utf-8')).toBe('untouched\n');
  }, 120_000);
});
