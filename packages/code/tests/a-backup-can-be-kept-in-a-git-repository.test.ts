// @plants-damage
/**
 * A backup kept in a git repository: what `setup`, `run`, `status`, `verify` and `restore` do when
 * the destination is a remote, and what they never do to its history.
 *
 * The remote is a local bare repository in a sandbox, and the data directory is the sandbox's: no
 * network remote is named, and nothing is written to the real home.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { type DiscoveryEnv, resolveTrees } from '@mnema/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  runBackupRestore,
  runBackupRun,
  runBackupSetup,
  runBackupStatus,
  runBackupVerify,
  runGlobalBackupRun,
  runGlobalBackupSetup,
} from '../src/commands/backup.js';
import { runInit } from '../src/commands/init.js';
import { runTask } from '../src/commands/task.js';
import { type CliIo, run } from '../src/program.js';

let sandbox: string;
let env: DiscoveryEnv;
let remote: string;

/** A git of the test, with its own identity and no repack behind a push. */
function git(cwd: string, ...args: string[]): string {
  const ran = spawnSync(
    'git',
    ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', ...args],
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
  sandbox = mkdtempSync(join(tmpdir(), 'mnema-backup-git-'));
  env = { home: join(sandbox, 'home') };
  remote = join(sandbox, 'destination.git');
  git(sandbox, '-c', 'init.defaultBranch=main', 'init', '-q', '--bare', remote);
  git(remote, 'config', 'gc.auto', '0');
  git(remote, 'config', 'maintenance.auto', 'false');
});

afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

/** A project in git with a task in each of its trees. */
function project(label: string) {
  const cwd = join(sandbox, label);
  mkdirSync(cwd, { recursive: true });
  git(cwd, 'init', '-q');
  runInit({ cwd, env });
  const ctx = { cwd, env };
  expect(runTask(ctx, { title: `work of ${label}` }).ok).toBe(true);
  expect(runTask(ctx, { title: `private work of ${label}`, scope: 'private' }).ok).toBe(true);
  return ctx;
}

describe('a backup kept in a git repository', () => {
  it('commits every run on top of the last, and the destination keeps both', () => {
    const a = project('alpha');
    expect(runBackupSetup(a, remote)).toMatchObject({ ok: true, git: true });
    expect(runBackupRun(a)).toMatchObject({ ok: true, pushed: { committed: true, pushed: 1 } });
    const first = git(remote, 'rev-parse', 'main');
    expect(runBackupRun(a)).toMatchObject({ ok: true, pushed: { committed: true, pushed: 1 } });
    expect(git(remote, 'rev-list', '--count', 'main')).toBe('2');
    expect(git(remote, 'rev-parse', 'main~1')).toBe(first);
  });

  it('verifies the copy it reads out of the destination, and says so when it is behind', () => {
    const a = project('alpha');
    runBackupSetup(a, remote);
    runBackupRun(a);
    expect(runBackupVerify(a)).toMatchObject({ ok: true, sound: true });
    expect(runTask(a, { title: 'after the backup', scope: 'private' }).ok).toBe(true);
    const behind = runBackupVerify(a);
    expect(behind.ok && behind.sound).toBe(true);
    expect(behind.ok && behind.trees[0] && 'reading' in behind.trees[0]).toBe(true);
    const status = runBackupStatus(a);
    expect(status.ok && status.trees[0]?.behind).toBeGreaterThan(0);
  });

  it('puts a deleted private tree back from a fresh clone of the destination', () => {
    const a = project('alpha');
    runBackupSetup(a, remote);
    runBackupRun(a);
    const priv = resolveTrees(a.cwd, env).projectPrivate as string;
    const before = readdirSync(join(priv, 'tails'));
    rmSync(priv, { recursive: true, force: true });
    // The clone cache is gone too: a restore reads the destination as it is, not a copy left here.
    rmSync(join(sandbox, 'home', '.mnema', 'backup-git'), { recursive: true, force: true });
    const done = runBackupRestore(a, false);
    expect(done.ok && done.trees[0]?.restored?.tails).toEqual(before);
    expect(existsSync(join(priv, 'tails'))).toBe(true);
    expect(runBackupVerify(a)).toMatchObject({ ok: true, sound: true });
  });

  it('copies the global tree to a git destination too, under global/', () => {
    const a = project('alpha');
    expect(runTask(a, { title: 'memory of alpha', scope: 'global' }).ok).toBe(true);
    expect(runGlobalBackupSetup(a, remote)).toMatchObject({ ok: true, git: true });
    const ran = runGlobalBackupRun(a);
    expect(ran).toMatchObject({ ok: true, pushed: { committed: true, pushed: 1 } });
    expect(git(remote, 'ls-tree', '-r', '--name-only', 'main')).toContain(
      'global/mnema-backup.json',
    );
  });

  it('is kept without a user or a password, printed without its userinfo, and never contacted by setup', () => {
    const a = project('alpha');
    const refused = runBackupSetup(a, 'https://user:hunter2@example.com/backup.git');
    expect(refused).toMatchObject({ ok: false, reason: 'BAD_DESTINATION' });
    expect(JSON.stringify(refused)).not.toContain('hunter2');
    expect(runBackupSetup(a, 'https://TOKEN123@example.com/backup.git')).toMatchObject({
      ok: false,
      reason: 'BAD_DESTINATION',
    });
    const set = runBackupSetup(a, 'ssh://git@example.invalid/backup.git');
    expect(set).toMatchObject({ ok: true, destination: 'ssh://example.invalid/backup.git' });
    const status = runBackupStatus(a);
    expect(status).toMatchObject({ ok: true, destination: 'ssh://example.invalid/backup.git' });
  });

  it('refuses a remote it cannot reach, with the remote named and nothing written', () => {
    const a = project('alpha');
    const nowhere = `file://${join(sandbox, 'does-not-exist.git')}`;
    expect(runBackupSetup(a, nowhere)).toMatchObject({ ok: true, git: true });
    const ran = runBackupRun(a);
    expect(ran).toMatchObject({ ok: false, reason: 'REFUSED', code: 'GIT_FAILED' });
    expect(ran.ok ? '' : JSON.stringify(ran)).toContain('does-not-exist.git');
    expect(existsSync(join(sandbox, 'does-not-exist.git'))).toBe(false);
  });
});

describe('what the verbs print of a git destination', () => {
  /** `mnema <argv>` in the project, in process, with a person at a terminal who says yes. */
  async function mnema(cwd: string, ...argv: string[]): Promise<{ text: string; failed: boolean }> {
    const out: string[] = [];
    let failed = false;
    const io: CliIo = {
      out: (line) => out.push(line),
      err: (line) => out.push(line),
      fail: () => {
        failed = true;
      },
      aPersonIsHere: true,
      ask: async () => 'yes',
    };
    const before = process.cwd();
    const home = process.env.HOME;
    process.chdir(cwd);
    process.env.HOME = join(sandbox, 'home');
    try {
      await run(argv, io);
    } finally {
      process.chdir(before);
      if (home === undefined) delete process.env.HOME;
      else process.env.HOME = home;
    }
    return { text: out.join('\n'), failed };
  }

  it('says, at setup, that the history is kept, and, at each run, what was committed and pushed', async () => {
    const a = project('alpha');
    const set = await mnema(a.cwd, 'backup', 'setup', remote);
    expect(set.failed, set.text).toBe(false);
    expect(set.text).toContain('This destination is a git repository');
    expect(set.text).toContain('The backup of record');
    const first = await mnema(a.cwd, 'backup', 'run');
    expect(first.failed, first.text).toBe(false);
    expect(first.text).toContain('git: committed, 1 commit(s) pushed');
    const status = await mnema(a.cwd, 'backup', 'status');
    expect(status.text).toContain(remote);
    expect(git(remote, 'rev-list', '--count', 'main')).toBe('1');
  });
});
