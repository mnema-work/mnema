/**
 * A git repository as the place a backup is kept: what names one, what is never kept of its name,
 * and what a run does to its history (it only adds to it).
 *
 * Every repository here is a local bare one in a sandbox: no network remote is ever named.
 */

import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  cacheOf,
  cleanGitEnv,
  commitAndPush,
  GitDestinationError,
  isGitDestination,
  standingOfCache,
  syncCache,
  whyNotARemote,
  withCacheLock,
  withoutUserinfo,
} from './git-destination.js';

let sandbox: string;
let remote: string;
let cache: string;

/** A git of the test, apart from the product's: its own identity, and no maintenance behind a push. */
function git(cwd: string, ...args: string[]): string {
  const ran = spawnSync(
    'git',
    [
      '-c',
      'maintenance.auto=false',
      '-c',
      'gc.auto=0',
      '-c',
      'user.name=t',
      '-c',
      'user.email=t@example.invalid',
      '-c',
      'commit.gpgsign=false',
      ...args,
    ],
    {
      cwd,
      encoding: 'utf-8',
      env: { PATH: process.env.PATH ?? '', HOME: sandbox, GIT_CONFIG_NOSYSTEM: '1' },
    },
  );
  if (ran.status !== 0) throw new Error(`git ${args.join(' ')}: ${ran.stderr}`);
  return ran.stdout.trim();
}

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'mnema-git-destination-'));
  remote = join(sandbox, 'destination.git');
  git(sandbox, '-c', 'init.defaultBranch=main', 'init', '-q', '--bare', remote);
  // The remote's own configuration: a push into it must not start a repack behind the test.
  git(remote, 'config', 'gc.auto', '0');
  git(remote, 'config', 'maintenance.auto', 'false');
  cache = cacheOf(join(sandbox, 'data'), remote);
});

afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

/** One run: bring the cache up to the remote, write a file, commit and push. */
function aRun(file: string, now: Date, env = cleanGitEnv()) {
  syncCache(remote, cache, env);
  mkdirSync(cache, { recursive: true });
  writeFileSync(join(cache, file), `${now.toISOString()}\n`);
  return commitAndPush(remote, cache, now, env);
}

describe('what names a git destination', () => {
  it('is a remote written as one, or the folder of a bare repository, and no other folder', () => {
    expect(isGitDestination('https://example.com/a/b.git')).toBe(true);
    expect(isGitDestination('ssh://git@example.com/a/b.git')).toBe(true);
    expect(isGitDestination('git@example.com:a/b.git')).toBe(true);
    expect(isGitDestination('file:///srv/b.git')).toBe(true);
    expect(isGitDestination(remote)).toBe(true);
    const folder = join(sandbox, 'just-a-folder');
    mkdirSync(folder);
    expect(isGitDestination(folder)).toBe(false);
    expect(isGitDestination('C:\\backups\\mnema')).toBe(false);
  });

  it('is printed without its userinfo', () => {
    expect(withoutUserinfo('ssh://git@example.com/a/b.git')).toBe('ssh://example.com/a/b.git');
    expect(withoutUserinfo('git@example.com:a/b.git')).toBe('example.com:a/b.git');
    expect(withoutUserinfo('https://example.com/a/b.git')).toBe('https://example.com/a/b.git');
  });

  it('is never kept with a password in it, nor an http(s) one with a user (a token is one), nor as an option', () => {
    expect(whyNotARemote('https://user:secret@example.com/a.git')).toMatch(/a password/);
    expect(whyNotARemote('https://TOKEN@example.com/a.git')).toMatch(/a user/);
    expect(whyNotARemote('ssh://git:pw@example.com/a.git')).toMatch(/a password/);
    expect(whyNotARemote('--upload-pack=x')).toMatch(/option/);
    expect(whyNotARemote('ssh://git@example.com/a.git')).toBeUndefined();
    expect(whyNotARemote('https://example.com/a.git')).toBeUndefined();
    // The refusal never prints the secret it refuses.
    expect(whyNotARemote('https://user:secret@example.com/a.git')).not.toContain('secret');
    expect(whyNotARemote('https://TOKEN@example.com/a.git')).not.toContain('TOKEN');
  });
});

describe('the environment every git of the destination runs with', () => {
  it('drops every variable named GIT_*, whatever its case, and turns the prompt off', () => {
    const clean = cleanGitEnv({
      PATH: '/bin',
      HOME: '/h',
      GIT_DIR: '/elsewhere/.git',
      GIT_INDEX_FILE: '/elsewhere/index',
      GIT_WORK_TREE: '/elsewhere',
      git_dir: '/lower',
      GIT_TERMINAL_PROMPT: '1',
    });
    expect(clean).toEqual({ PATH: '/bin', HOME: '/h', GIT_TERMINAL_PROMPT: '0' });
  });

  it('keeps a git that was started from a hook off the repository being committed in', () => {
    const decoy = join(sandbox, 'decoy');
    git(sandbox, 'init', '-q', decoy);
    const before = git(decoy, 'count-objects', '-v');
    const had = process.env.GIT_DIR;
    process.env.GIT_DIR = join(decoy, '.git');
    process.env.GIT_INDEX_FILE = join(decoy, '.git', 'index');
    try {
      aRun('one.txt', new Date('2026-01-01T00:00:00Z'));
    } finally {
      if (had === undefined) delete process.env.GIT_DIR;
      else process.env.GIT_DIR = had;
      delete process.env.GIT_INDEX_FILE;
    }
    expect(git(remote, 'log', '--format=%s')).toBe('Back up 2026-01-01T00:00:00.000Z');
    expect(git(decoy, 'count-objects', '-v')).toBe(before);
    expect(git(decoy, 'status', '--porcelain')).toBe('');
  });
});

describe('the history of a git destination', () => {
  it('holds a commit for every run, the first one still there and still the parent of the next', () => {
    expect(aRun('a.txt', new Date('2026-01-01T00:00:00Z'))).toEqual({ committed: true, pushed: 1 });
    const first = git(remote, 'rev-parse', 'main');
    expect(aRun('b.txt', new Date('2026-01-02T00:00:00Z'))).toEqual({ committed: true, pushed: 1 });
    expect(git(remote, 'log', '--format=%s')).toBe(
      'Back up 2026-01-02T00:00:00.000Z\nBack up 2026-01-01T00:00:00.000Z',
    );
    expect(git(remote, 'rev-parse', 'main~1')).toBe(first);
  });

  it('commits nothing where the copy changed nothing, and says so', () => {
    aRun('a.txt', new Date('2026-01-01T00:00:00Z'));
    syncCache(remote, cache);
    expect(commitAndPush(remote, cache, new Date('2026-01-02T00:00:00Z'))).toEqual({
      committed: false,
      pushed: 0,
    });
    expect(git(remote, 'rev-list', '--count', 'main')).toBe('1');
  });

  it('is cloned afresh on another machine, and holds what the first one pushed', () => {
    aRun('a.txt', new Date('2026-01-01T00:00:00Z'));
    const other = cacheOf(join(sandbox, 'other-data'), remote);
    syncCache(remote, other);
    expect(existsSync(join(other, 'a.txt'))).toBe(true);
  });

  it('never forces a push: a remote that moved on is not overwritten', () => {
    aRun('a.txt', new Date('2026-01-01T00:00:00Z'));
    // Another machine pushes between this one's sync and its push.
    const other = cacheOf(join(sandbox, 'other-data'), remote);
    syncCache(remote, other);
    writeFileSync(join(other, 'theirs.txt'), 'theirs\n');
    commitAndPush(remote, other, new Date('2026-01-03T00:00:00Z'));
    const theirs = git(remote, 'rev-parse', 'main');

    writeFileSync(join(cache, 'mine.txt'), 'mine\n');
    expect(() => commitAndPush(remote, cache, new Date('2026-01-04T00:00:00Z'))).toThrow(
      GitDestinationError,
    );
    expect(git(remote, 'rev-parse', 'main')).toBe(theirs);
    expect(git(remote, 'log', '--format=%s')).toContain('Back up 2026-01-03T00:00:00.000Z');
  });

  it('goes on top of what another machine pushed, by a fast-forward, and refuses when both went their ways', () => {
    aRun('a.txt', new Date('2026-01-01T00:00:00Z'));
    const other = cacheOf(join(sandbox, 'other-data'), remote);
    syncCache(remote, other);
    writeFileSync(join(other, 'theirs.txt'), 'theirs\n');
    commitAndPush(remote, other, new Date('2026-01-03T00:00:00Z'));

    // This machine's next run brings theirs in first, and adds one commit after it.
    aRun('b.txt', new Date('2026-01-04T00:00:00Z'));
    expect(git(remote, 'rev-list', '--count', 'main')).toBe('3');
    expect(existsSync(join(cache, 'theirs.txt'))).toBe(true);

    // Now a commit on each side that the other lacks: neither is overwritten.
    writeFileSync(join(cache, 'only-here.txt'), 'x\n');
    git(cache, 'add', '-A');
    git(cache, 'commit', '-q', '-m', 'unpushed here');
    writeFileSync(join(other, 'only-there.txt'), 'y\n');
    syncCache(remote, other);
    commitAndPush(remote, other, new Date('2026-01-05T00:00:00Z'));
    const there = git(remote, 'rev-parse', 'main');
    expect(() => syncCache(remote, cache)).toThrow(/gone different ways/);
    expect(git(remote, 'rev-parse', 'main')).toBe(there);
    expect(git(cache, 'log', '-1', '--format=%s')).toBe('unpushed here');
  });

  it('is not the clone of another remote, and refuses to be read as one', () => {
    aRun('a.txt', new Date('2026-01-01T00:00:00Z'));
    const another = join(sandbox, 'another.git');
    git(sandbox, 'init', '-q', '--bare', another);
    expect(() => syncCache(another, cache)).toThrow(/another remote/);
  });

  it('puts no user and no password of a remote in what it says when git fails', () => {
    const gone = 'ssh://someone@127.0.0.1:9/never.git';
    expect.assertions(2);
    try {
      syncCache(gone, join(sandbox, 'cache-of-gone'), {
        ...cleanGitEnv(),
        GIT_SSH_COMMAND: 'false',
      });
    } catch (error) {
      const said = (error as Error).message;
      expect(said).toContain('ssh://127.0.0.1:9/never.git');
      expect(said).not.toContain('someone');
    }
  });
});

describe('a push that did not go up', () => {
  const reject = (): string => join(remote, 'hooks', 'pre-receive');

  it('leaves its commit in the cache, which counts it as unpushed until a run sends it', () => {
    writeFileSync(reject(), '#!/bin/sh\nexit 1\n');
    chmodSync(reject(), 0o755);
    expect(() => aRun('a.txt', new Date('2026-01-01T00:00:00Z'))).toThrow(GitDestinationError);
    // The cache holds the commit; a comparison of the cache alone would call the copy up to date.
    expect(git(cache, 'rev-list', '--count', 'HEAD')).toBe('1');
    expect(standingOfCache(remote, cache)).toEqual({ unpushed: 1, diverged: false });
    rmSync(reject());
    expect(aRun('b.txt', new Date('2026-01-02T00:00:00Z'))).toEqual({ committed: true, pushed: 2 });
    expect(standingOfCache(remote, cache)).toEqual({ unpushed: 0, diverged: false });
    expect(git(remote, 'rev-list', '--count', 'main')).toBe('2');
  });

  it('says a divergence, and names the folder to look at and to remove by hand', () => {
    aRun('a.txt', new Date('2026-01-01T00:00:00Z'));
    const other = cacheOf(join(sandbox, 'other-data'), remote);
    syncCache(remote, other);
    writeFileSync(join(other, 'theirs.txt'), 'theirs\n');
    commitAndPush(remote, other, new Date('2026-01-03T00:00:00Z'));
    writeFileSync(join(cache, 'mine.txt'), 'mine\n');
    git(cache, 'add', '-A');
    git(cache, 'commit', '-q', '-m', 'unpushed here');
    git(cache, 'fetch', '-q', 'origin');
    expect(standingOfCache(remote, cache)).toEqual({ unpushed: 1, diverged: true });
    let said = '';
    try {
      syncCache(remote, cache);
    } catch (error) {
      said = (error as Error).message;
    }
    expect(said).toContain(cache);
    expect(said).toContain('remove the folder');
    expect(said).toContain('never removes it for you');
    expect(existsSync(cache)).toBe(true);
  });

  it('commits and pushes nothing, and fails nothing, where nothing was ever copied', () => {
    syncCache(remote, cache);
    expect(commitAndPush(remote, cache, new Date('2026-01-01T00:00:00Z'))).toEqual({
      committed: false,
      pushed: 0,
    });
    expect(standingOfCache(remote, cache)).toEqual({ unpushed: 0, diverged: false });
  });

  it('holds the cache against another run while one is in it', () => {
    withCacheLock(cache, () => {
      expect(existsSync(`${cache}.lock`)).toBe(true);
    });
    expect(existsSync(`${cache}.lock`)).toBe(false);
  });

  it('names the lock file, the process that holds it and how to clear it when a pid that is still alive holds it', () => {
    // The parent of this process answers to a signal and is not a backup: a pid reused by another process.
    mkdirSync(dirname(cache), { recursive: true });
    writeFileSync(`${cache}.lock`, `${process.ppid} ${Date.now()}\n`);
    let said = '';
    try {
      withCacheLock(cache, () => 'never', 1000);
    } catch (error) {
      said = (error as Error).message;
    }
    expect(said).toContain(`process ${process.ppid} holds ${cache}.lock`);
    expect(said).toContain(`delete ${cache}.lock and run again`);
    expect(said).toContain('did not finish in 1 second.');
    expect(existsSync(`${cache}.lock`)).toBe(true);
  });
});

describe('a destination written with a password', () => {
  it('is taken as a remote, refused for it, and never echoed', () => {
    expect(isGitDestination('u:pw@host:repo.git')).toBe(true);
    const why = whyNotARemote('u:pw@host:repo.git') ?? '';
    expect(why).toMatch(/a password/);
    expect(why).not.toContain('pw');
    expect(why).not.toContain('u:');
    expect(withoutUserinfo('u:pw@host:repo.git')).toBe('host:repo.git');
  });
});
