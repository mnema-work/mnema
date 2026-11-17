/**
 * `mnema backup`: two projects on one machine, each with its own folder, and what a run of one
 * of them puts where. The engine's own rules (what is copied, what is refused) are the core's
 * (`topology/backup/copy.test.ts`); what is held here is the PROJECT: whose folder is whose,
 * and that no folder is inherited.
 */

// @plants-damage
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
import { type DiscoveryEnv, resolveTrees } from '@mnema/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runBackupRun, runBackupSetup, runBackupStatus } from './backup.js';
import { runInit } from './init.js';
import { runTask } from './task.js';

let sandbox: string;
let env: DiscoveryEnv;

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'mnema-backup-'));
  env = { home: join(sandbox, 'home') };
});

afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

/** A project named `label`, with a task in each of its two trees, in git or not. */
function project(label: string, inGit: boolean) {
  const cwd = join(sandbox, label);
  mkdirSync(cwd, { recursive: true });
  if (inGit) {
    const ran = spawnSync('git', ['init', '-q'], {
      cwd,
      env: {
        PATH: process.env.PATH ?? '',
        HOME: sandbox,
        GIT_CONFIG_NOSYSTEM: '1',
        GIT_CONFIG_GLOBAL: '/dev/null',
      },
    });
    expect(ran.status).toBe(0);
  }
  runInit({ cwd, env });
  const ctx = { cwd, env };
  expect(runTask(ctx, { title: `work of ${label}` }).ok).toBe(true);
  expect(runTask(ctx, { title: `private work of ${label}`, scope: 'private' }).ok).toBe(true);
  return ctx;
}

/** Every file under `dir`, `/`-separated. */
function filesUnder(dir: string, prefix = ''): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? filesUnder(join(dir, entry.name), `${prefix}${entry.name}/`)
      : [`${prefix}${entry.name}`],
  );
}

describe('the backup of two projects on one machine', () => {
  it('keeps each project in the folder it was set up with, and never one in the other', () => {
    const a = project('alpha', false);
    const b = project('beta', true);
    const folderA = join(sandbox, 'folder-a');
    const folderB = join(sandbox, 'folder-b');

    const setupA = runBackupSetup(a, folderA);
    const setupB = runBackupSetup(b, folderB);
    expect(setupA.ok && setupB.ok).toBe(true);
    if (!setupA.ok || !setupB.ok) return;
    expect(setupA.record).not.toBe(setupB.record);

    const runA = runBackupRun(a);
    const runB = runBackupRun(b);
    expect(runA.ok && runB.ok).toBe(true);

    const inA = filesUnder(folderA);
    const inB = filesUnder(folderB);
    expect(inA.every((file) => file.startsWith(`${setupA.record}/`))).toBe(true);
    expect(inB.every((file) => file.startsWith(`${setupB.record}/`))).toBe(true);
    expect(inA.some((file) => file.includes(setupB.record))).toBe(false);
    expect(inB.some((file) => file.includes(setupA.record))).toBe(false);
    // A project outside git has its public tree copied too; one in git leaves it to git.
    expect(new Set(inA.map((file) => file.split('/')[1]))).toEqual(new Set(['private', 'public']));
    expect(new Set(inB.map((file) => file.split('/')[1]))).toEqual(new Set(['private']));
  });

  it('gives a project that was never set up no folder, whatever the machine knows', () => {
    const a = project('alpha', false);
    const b = project('beta', false);
    expect(runBackupSetup(a, join(sandbox, 'folder-a')).ok).toBe(true);

    for (const result of [runBackupRun(b), runBackupStatus(b)]) {
      expect(result).toMatchObject({ ok: false, reason: 'NO_DESTINATION' });
    }
    expect(filesUnder(join(sandbox, 'folder-a'))).toEqual([]);
  });

  it('says how far the copy is, and what a run added', () => {
    const a = project('alpha', false);
    const folder = join(sandbox, 'folder-a');
    runBackupSetup(a, folder);
    const before = runBackupStatus(a);
    expect(before.ok && before.trees.every((one) => one.behind === one.files)).toBe(true);
    runBackupRun(a);
    const after = runBackupStatus(a);
    expect(after.ok && after.trees.map((one) => one.behind)).toEqual([0, 0]);
    runTask(a, { title: 'one more' });
    const again = runBackupStatus(a);
    expect(again.ok && again.trees.some((one) => one.behind > 0)).toBe(true);
  });

  it('refuses a folder inside the working tree, and copies nothing of the key root', () => {
    const a = project('alpha', false);
    expect(runBackupSetup(a, join(a.cwd, 'bk'))).toMatchObject({
      ok: false,
      reason: 'BAD_DESTINATION',
    });
    expect(runBackupSetup(a, join(a.cwd, '.mnema', 'bk'))).toMatchObject({ ok: false });
    const folder = join(sandbox, 'folder-a');
    runBackupSetup(a, folder);
    const trees = resolveTrees(a.cwd, env);
    mkdirSync(trees.keyRoot, { recursive: true });
    writeFileSync(join(trees.keyRoot, 'keys.key'), 'machine key material');
    runBackupRun(a);
    expect(filesUnder(folder).filter((file) => /\.key$|identity/.test(file))).toEqual([]);
  });

  it('refuses a run whole when a tail holds a private key, and when a tail is a link', () => {
    const a = project('alpha', false);
    const folder = join(sandbox, 'folder-a');
    runBackupSetup(a, folder);
    const trees = resolveTrees(a.cwd, env);
    const privateTails = join(trees.projectPrivate as string, 'tails');
    const [tail] = readdirSync(privateTails);
    writeFileSync(
      join(privateTails, tail as string, '000009.jsonl'),
      '{"x":"-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----"}\n',
    );
    expect(runBackupRun(a)).toMatchObject({ ok: false, code: 'PRIVATE_KEY' });
    expect(filesUnder(folder)).toEqual([]);
    rmSync(join(privateTails, tail as string, '000009.jsonl'));

    const outside = join(sandbox, 'outside');
    mkdirSync(outside);
    symlinkSync(outside, join(privateTails, 'cc33-dd44'), 'dir');
    expect(runBackupRun(a)).toMatchObject({ ok: false, code: 'LINKED' });
    expect(filesUnder(folder)).toEqual([]);
    expect(readFileSync(join(env.home, '.mnema', 'backup.json'), 'utf-8')).toContain(folder);
  });
});
