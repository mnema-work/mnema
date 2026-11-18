/**
 * The optional `post-commit` hook that runs the backup after a commit.
 *
 * WHAT IS HELD:
 *   - it is written by `backup hook install` and by nothing else, where git reads hooks, and
 *     `uninstall` takes it out;
 *   - a `core.hooksPath` inside the working tree is refused, one outside it is followed;
 *   - a shell hook that was there keeps its text and gets a block that `uninstall` takes out to
 *     the byte; a hook that is not a shell script is never touched;
 *   - a commit made with the hook installed runs the backup, whose destination then holds the
 *     copy, and the program the hook starts meets no variable named `GIT_*`.
 *
 * The hook runs through the BUILT binary, the way a commit meets it, into a local bare repository.
 */

import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runBackupSetup } from '../src/commands/backup.js';
import {
  BACKUP_HOOK_BLOCK,
  BACKUP_HOOK_SCRIPT,
  installBackupHook,
  uninstallBackupHook,
} from '../src/commands/backup-hook.js';
import { runInit } from '../src/commands/init.js';
import { runTask } from '../src/commands/task.js';
import { MNEMA_CLI } from './support/the-cli.js';

let sandbox: string;
let repo: string;
let remote: string;

/** The environment a git of the test gets: the sandbox's own, with no variable of the host's. */
function envWith(path: string): Record<string, string> {
  return {
    PATH: path,
    HOME: join(sandbox, 'home'),
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: join(sandbox, 'gitconfig'),
    GIT_AUTHOR_NAME: 'a',
    GIT_AUTHOR_EMAIL: 'a@example.invalid',
    GIT_COMMITTER_NAME: 'a',
    GIT_COMMITTER_EMAIL: 'a@example.invalid',
  };
}

/** `git <args>` in `cwd` (the repository by default). */
function git(args: string[], path = process.env.PATH ?? '', cwd = repo) {
  // No repack behind a push to the local remote: both settings on the command line, and in the remote's own file.
  return spawnSync('git', ['-c', 'maintenance.auto=false', '-c', 'gc.auto=0', ...args], {
    cwd,
    encoding: 'utf-8',
    env: envWith(path),
  });
}

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'mnema-backup-hook-'));
  repo = join(sandbox, 'repo');
  remote = join(sandbox, 'destination.git');
  mkdirSync(repo, { recursive: true });
  mkdirSync(join(sandbox, 'home'), { recursive: true });
  // No repack behind a push to the local remote: the file every git of a test that writes a repository reads.
  writeFileSync(join(sandbox, 'gitconfig'), '[maintenance]\n\tauto = false\n[gc]\n\tauto = 0\n');
  expect(
    git(['-c', 'init.defaultBranch=main', 'init', '-q', '--bare', remote], undefined, sandbox)
      .status,
  ).toBe(0);
  expect(git(['init', '-q', '-b', 'main']).status).toBe(0);
});

afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

const HOOK = (): string => join(repo, '.git', 'hooks', 'post-commit');

describe('installing and removing the hook', () => {
  it('is written by the verb, executable, and taken out by the same verb', () => {
    const ctx = { cwd: repo };
    expect(existsSync(HOOK())).toBe(false);
    expect(installBackupHook(ctx)).toEqual({ ok: true, path: HOOK(), state: 'installed' });
    expect(readFileSync(HOOK(), 'utf-8')).toBe(BACKUP_HOOK_SCRIPT);
    expect(statSync(HOOK()).mode & 0o111).not.toBe(0);
    expect(installBackupHook(ctx)).toEqual({ ok: true, path: HOOK(), state: 'already' });
    expect(uninstallBackupHook(ctx)).toEqual({ ok: true, path: HOOK(), state: 'removed' });
    expect(existsSync(HOOK())).toBe(false);
    expect(uninstallBackupHook(ctx)).toEqual({ ok: true, path: HOOK(), state: 'absent' });
  });

  it('is not written by init, nor by a setup of the backup', () => {
    const ctx = { cwd: repo, env: { home: join(sandbox, 'home') } };
    runInit(ctx);
    expect(runBackupSetup(ctx, remote).ok).toBe(true);
    expect(existsSync(HOOK())).toBe(false);
  });

  it('refuses a core.hooksPath inside the working tree, relative or absolute, and writes nothing', () => {
    git(['config', 'core.hooksPath', '.githooks']);
    expect(installBackupHook({ cwd: repo })).toMatchObject({
      ok: false,
      reason: 'HOOKS_PATH_IN_TREE',
    });
    expect(existsSync(join(repo, '.githooks'))).toBe(false);
    git(['config', 'core.hooksPath', join(repo, 'tools', 'hooks')]);
    expect(installBackupHook({ cwd: repo })).toMatchObject({
      ok: false,
      reason: 'HOOKS_PATH_IN_TREE',
    });
    expect(existsSync(join(repo, 'tools'))).toBe(false);
  });

  it('follows a core.hooksPath outside the working tree', () => {
    const elsewhere = join(sandbox, 'shared-hooks');
    git(['config', 'core.hooksPath', elsewhere]);
    expect(installBackupHook({ cwd: repo })).toMatchObject({
      ok: true,
      state: 'installed',
      path: join(elsewhere, 'post-commit'),
    });
    expect(uninstallBackupHook({ cwd: repo })).toMatchObject({ ok: true, state: 'removed' });
  });

  it('adds its block to a shell hook that was there and takes out exactly the block, to the byte', () => {
    mkdirSync(join(repo, '.git', 'hooks'), { recursive: true });
    for (const theirs of [
      '#!/bin/sh\necho theirs\n',
      '#!/usr/bin/env bash\necho theirs',
      '#!/bin/sh\n',
    ]) {
      writeFileSync(HOOK(), theirs);
      expect(installBackupHook({ cwd: repo })).toMatchObject({ ok: true, state: 'installed' });
      const grown = readFileSync(HOOK(), 'utf-8');
      expect(grown.startsWith(theirs)).toBe(true);
      expect(grown).toContain(BACKUP_HOOK_BLOCK);
      expect(installBackupHook({ cwd: repo })).toMatchObject({ ok: true, state: 'already' });
      expect(uninstallBackupHook({ cwd: repo })).toMatchObject({ ok: true, state: 'removed' });
      expect(readFileSync(HOOK(), 'utf-8')).toBe(theirs);
    }
  });

  it('never touches a hook that is not a shell script, and says there is nothing of its own to remove', () => {
    mkdirSync(join(repo, '.git', 'hooks'), { recursive: true });
    const theirs = '#!/usr/bin/env python3\nprint("theirs")\n';
    writeFileSync(HOOK(), theirs);
    expect(installBackupHook({ cwd: repo })).toEqual({
      ok: false,
      reason: 'FOREIGN_HOOK',
      path: HOOK(),
    });
    expect(uninstallBackupHook({ cwd: repo })).toEqual({ ok: true, path: HOOK(), state: 'absent' });
    expect(readFileSync(HOOK(), 'utf-8')).toBe(theirs);
  });

  it('refuses outside a repository', () => {
    const outside = mkdtempSync(join(tmpdir(), 'mnema-no-repo-'));
    try {
      expect(installBackupHook({ cwd: outside })).toEqual({
        ok: false,
        reason: 'NOT_A_REPOSITORY',
      });
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });
});

describe('a commit with the hook installed', () => {
  /** A directory of programs: `mnema` as the script that records what it was given and runs the CLI. */
  function bin(): { dir: string; seen: string } {
    // mnema first on the PATH, then the machine's own: the hook's shell needs `env` and `sed`.
    const dir = join(sandbox, 'bin');
    mkdirSync(dir, { recursive: true });
    const seen = join(sandbox, 'seen-env.txt');
    writeFileSync(
      join(dir, 'mnema'),
      `#!/bin/sh\nenv > "${seen}"\nexec "${process.execPath}" "${MNEMA_CLI}" "$@"\n`,
    );
    chmodSync(join(dir, 'mnema'), 0o755);
    return { dir: `${dir}${delimiter}${process.env.PATH ?? ''}`, seen };
  }

  /** Waits, for at most `ms`, until `done` holds. */
  function until(done: () => boolean, ms: number): boolean {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      if (done()) return true;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
    }
    return done();
  }

  it('runs the backup, whose destination then holds the copy, and starts mnema with no GIT_* variable', () => {
    const ctx = { cwd: repo, env: { home: join(sandbox, 'home') } };
    runInit(ctx);
    expect(runTask(ctx, { title: 'private work', scope: 'private' }).ok).toBe(true);
    expect(runBackupSetup(ctx, remote)).toMatchObject({ ok: true, git: true });
    expect(installBackupHook({ cwd: repo }).ok).toBe(true);

    const { dir, seen } = bin();
    writeFileSync(join(repo, 'file.txt'), 'x\n');
    expect(git(['add', 'file.txt'], dir).status).toBe(0);
    const committed = git(['commit', '-q', '-m', 'a change'], dir);
    expect(committed.status, committed.stderr).toBe(0);

    const held = until(
      () => git(['rev-list', '--count', 'main'], dir, remote).stdout.trim() === '1',
      50_000,
    );
    expect(held, 'the backup of the hook reached the destination').toBe(true);
    expect(git(['ls-tree', '-r', '--name-only', 'main'], dir, remote).stdout).toContain(
      '/private/',
    );
    // What git hands a hook (GIT_INDEX_FILE, GIT_EXEC_PATH) is gone before mnema starts.
    const inherited = readFileSync(seen, 'utf-8')
      .split('\n')
      .filter((line) => /^GIT_/i.test(line));
    expect(inherited).toEqual([]);
  }, 60_000);

  it('does nothing, and fails nothing, in a project that was given no destination', () => {
    const ctx = { cwd: repo, env: { home: join(sandbox, 'home') } };
    runInit(ctx);
    expect(installBackupHook({ cwd: repo }).ok).toBe(true);
    const { dir } = bin();
    writeFileSync(join(repo, 'file.txt'), 'x\n');
    git(['add', 'file.txt'], dir);
    expect(git(['commit', '-q', '-m', 'a change'], dir).status).toBe(0);
    expect(git(['for-each-ref'], dir, remote).stdout.trim()).toBe('');
  });
});
