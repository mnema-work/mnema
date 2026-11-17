/**
 * `mnema backup`: two projects on one machine, each with its own folder, and what a run of one
 * of them puts where. The engine's own rules (what is copied, what is refused) are the core's
 * (`topology/backup/copy.test.ts`); what is held here is the PROJECT: whose folder is whose,
 * and that no folder is inherited.
 */

// @plants-damage
import { spawnSync } from 'node:child_process';
import {
  cpSync,
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
import { tailLockPath, withTailLock } from '@mnema/chain';
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
  runGlobalBackupStatus,
} from './backup.js';
import { runInit } from './init.js';
import { runTask } from './task.js';
import { runVerify } from './verify.js';

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

/** The bytes of every file under `dir`, with its path: equal digests mean an identical folder. */
function digest(dir: string): string {
  return filesUnder(dir)
    .map((file) => `${file}:${readFileSync(join(dir, file)).toString('base64')}`)
    .join('\n');
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

  it('refuses a folder that is a file, says what a second setup replaced, and a backup file it cannot read', () => {
    const a = project('alpha', false);
    const file = join(sandbox, 'a-file');
    writeFileSync(file, 'not a folder');
    expect(runBackupSetup(a, file)).toMatchObject({ ok: false, reason: 'BAD_DESTINATION' });
    const first = join(sandbox, 'first');
    const second = join(sandbox, 'second');
    expect(runBackupSetup(a, first)).toMatchObject({ ok: true, replaced: undefined });
    expect(runBackupSetup(a, second)).toMatchObject({ ok: true, replaced: first });
    writeFileSync(join(env.home, '.mnema', 'backup.json'), 'not json');
    for (const refused of [runBackupRun(a), runBackupStatus(a), runBackupSetup(a, first)]) {
      expect(refused).toMatchObject({ ok: false, code: 'BACKUP_CONFIG' });
    }
  });

  it('writes nothing of either tree when one of them is refused', () => {
    const a = project('alpha', false);
    const folder = join(sandbox, 'folder-a');
    const set = runBackupSetup(a, folder);
    expect(set.ok).toBe(true);
    if (!set.ok) return;
    expect(runBackupRun(a).ok).toBe(true);
    const copy = join(folder, set.record);
    const publicTails = join(copy, 'public', 'tails');
    const [tail] = readdirSync(publicTails);
    const segment = join(publicTails, tail as string, '000001.jsonl');
    const held = readFileSync(segment);
    held[0] = held[0] === 0x7b ? 0x20 : 0x7b;
    writeFileSync(segment, held);
    expect(runTask(a, { title: 'one more in the private tree', scope: 'private' }).ok).toBe(true);
    const before = digest(copy);
    expect(runBackupRun(a)).toMatchObject({ ok: false, code: 'DIVERGED' });
    expect(digest(copy)).toBe(before);
  });

  it('refuses a folder that is a link, and one inside the key root', () => {
    const a = project('alpha', false);
    const real = join(sandbox, 'real');
    mkdirSync(real);
    symlinkSync(real, join(sandbox, 'linked'), 'dir');
    expect(runBackupSetup(a, join(sandbox, 'linked'))).toMatchObject({
      ok: false,
      reason: 'BAD_DESTINATION',
    });
    const trees = resolveTrees(a.cwd, env);
    expect(runBackupSetup(a, join(env.home, '.mnema'))).toMatchObject({ ok: false });
    expect(runBackupSetup(a, join(trees.keyRoot, 'copy'))).toMatchObject({
      ok: false,
      reason: 'BAD_DESTINATION',
    });
  });

  it('refuses outside a project', () => {
    expect(runBackupRun({ cwd: sandbox, env })).toMatchObject({ ok: false, reason: 'NO_PROJECT' });
    expect(runBackupStatus({ cwd: sandbox, env })).toMatchObject({
      ok: false,
      reason: 'NO_PROJECT',
    });
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

describe("the backup of the machine's global tree", () => {
  /** A project with a task in the global tree too, so there is something of it to copy. */
  function withGlobal(label: string) {
    const ctx = project(label, false);
    expect(runTask(ctx, { title: `memory of ${label}`, scope: 'global' }).ok).toBe(true);
    return ctx;
  }

  it("has no folder until it is given one, and a project's folder is not its folder", () => {
    const a = withGlobal('alpha');
    expect(runBackupSetup(a, join(sandbox, 'folder-a')).ok).toBe(true);
    for (const result of [runGlobalBackupRun(a), runGlobalBackupStatus(a)]) {
      expect(result).toMatchObject({ ok: false, reason: 'NO_GLOBAL_DESTINATION' });
    }
    expect(filesUnder(join(sandbox, 'folder-a')).some((file) => file.includes('global'))).toBe(
      false,
    );
  });

  it("is copied only by a global run, only to its own folder, and never by a project's run", () => {
    const a = withGlobal('alpha');
    const folderA = join(sandbox, 'folder-a');
    const folderG = join(sandbox, 'folder-g');
    expect(runBackupSetup(a, folderA).ok).toBe(true);
    expect(runGlobalBackupSetup(a, folderG).ok).toBe(true);

    expect(runBackupRun(a).ok).toBe(true);
    expect(filesUnder(folderG)).toEqual([]);
    expect(filesUnder(folderA).some((file) => file.startsWith('global/'))).toBe(false);

    const done = runGlobalBackupRun(a);
    expect(done.ok && done.copied !== undefined && done.copied.files > 0).toBe(true);
    const held = filesUnder(folderG);
    expect(held.length).toBeGreaterThan(0);
    expect(held.every((file) => file.startsWith('global/'))).toBe(true);
    expect(held).toContain('global/mnema-backup.json');
    // The project's folder holds what it held before the global run, and the global folder none of a project's.
    expect(filesUnder(folderA).every((file) => !file.startsWith('global/'))).toBe(true);
    const manifest = JSON.parse(
      readFileSync(join(folderG, 'global', 'mnema-backup.json'), 'utf-8'),
    );
    expect(manifest).toMatchObject({ tree: 'global' });
    expect(manifest.record).toBeUndefined();
  });

  it('copies the same folder for a project and for the global tree without mixing them', () => {
    const a = withGlobal('alpha');
    const folder = join(sandbox, 'shared');
    const set = runBackupSetup(a, folder);
    expect(set.ok && runGlobalBackupSetup(a, folder).ok).toBe(true);
    if (!set.ok) return;
    expect(runBackupRun(a).ok && runGlobalBackupRun(a).ok).toBe(true);
    const roots = new Set(filesUnder(folder).map((file) => file.split('/')[0]));
    expect(roots).toEqual(new Set([set.record, 'global']));
  });

  it('copies neither the diagnostics log nor the report state, and nothing of the key root', () => {
    const a = withGlobal('alpha');
    const folderG = join(sandbox, 'folder-g');
    expect(runGlobalBackupSetup(a, folderG).ok).toBe(true);
    const trees = resolveTrees(a.cwd, env);
    writeFileSync(join(trees.global, 'diagnostics.jsonl'), '{"problem":"x"}\n');
    writeFileSync(join(trees.global, 'report-state.json'), '{"switch":true}');
    mkdirSync(trees.keyRoot, { recursive: true });
    writeFileSync(join(trees.keyRoot, 'machine.key'), 'machine key material');
    expect(runGlobalBackupRun(a).ok).toBe(true);
    const held = filesUnder(folderG);
    expect(held.filter((file) => /diagnostics|report-state|\.key$|identity/.test(file))).toEqual(
      [],
    );
    expect(held.some((file) => file.endsWith('.jsonl'))).toBe(true);
  });

  it('refuses a folder inside a repository from outside it as from inside it, for the global tree and a project', () => {
    const inGit = project('beta', true);
    const outside = { cwd: sandbox, env };
    const leak = join(inGit.cwd, 'leak');
    for (const ctx of [inGit, outside]) {
      expect(runGlobalBackupSetup(ctx, leak)).toMatchObject({
        ok: false,
        reason: 'BAD_DESTINATION',
      });
    }
    const free = project('alpha', false);
    expect(runBackupSetup(free, join(inGit.cwd, 'elsewhere'))).toMatchObject({
      ok: false,
      reason: 'BAD_DESTINATION',
    });
    expect(existsSync(join(env.home, '.mnema', 'backup.json'))).toBe(false);
  });

  it('works outside a project, and says there is no global tree yet where there is none', () => {
    const outside = { cwd: sandbox, env };
    const folder = join(sandbox, 'folder-g');
    expect(runGlobalBackupSetup(outside, folder).ok).toBe(true);
    expect(runGlobalBackupRun(outside)).toMatchObject({ ok: true, copied: undefined });
    expect(runGlobalBackupStatus(outside)).toMatchObject({ ok: true, standing: undefined });
    expect(filesUnder(folder)).toEqual([]);
  });

  it('keeps each assignment when the other is made, and says what a second one replaced', () => {
    const a = withGlobal('alpha');
    const folderA = join(sandbox, 'folder-a');
    const first = join(sandbox, 'g1');
    const second = join(sandbox, 'g2');
    expect(runGlobalBackupSetup(a, first)).toMatchObject({ ok: true, replaced: undefined });
    expect(runBackupSetup(a, folderA).ok).toBe(true);
    expect(runGlobalBackupSetup(a, second)).toMatchObject({ ok: true, replaced: first });
    expect(runBackupStatus(a)).toMatchObject({ ok: true, destination: folderA });
    expect(runGlobalBackupStatus(a)).toMatchObject({ ok: true, destination: second });
  });

  it('says how far the copy is, and refuses a folder inside the data directory', () => {
    const a = withGlobal('alpha');
    const folder = join(sandbox, 'folder-g');
    expect(runGlobalBackupSetup(a, folder).ok).toBe(true);
    const before = runGlobalBackupStatus(a);
    expect(
      before.ok &&
        before.standing !== undefined &&
        before.standing.behind === before.standing.files,
    ).toBe(true);
    runGlobalBackupRun(a);
    const after = runGlobalBackupStatus(a);
    expect(after.ok && after.standing?.behind).toBe(0);
    expect(runGlobalBackupSetup(a, join(env.home, '.mnema', 'copy'))).toMatchObject({
      ok: false,
      reason: 'BAD_DESTINATION',
    });
  });

  it('is no way to carry the signing key: a machine that lost it goes on under a new key, and what the old one signed still verifies', () => {
    const a = withGlobal('alpha');
    const folder = join(sandbox, 'folder-a');
    expect(runBackupSetup(a, folder).ok && runGlobalBackupSetup(a, folder).ok).toBe(true);
    expect(runBackupRun(a).ok && runGlobalBackupRun(a).ok).toBe(true);
    const trees = resolveTrees(a.cwd, env);
    // Nothing a copy holds is the key: the private files of the key root are in no copied file, whole.
    const secret = filesUnder(trees.keyRoot).filter((file) => !file.endsWith('.pub'));
    expect(secret.length).toBeGreaterThan(0);
    const copies = filesUnder(folder).map((file) => readFileSync(join(folder, file), 'utf-8'));
    for (const file of secret) {
      const bytes = readFileSync(join(trees.keyRoot, file), 'utf-8');
      expect(copies.some((text) => text.includes(bytes.trim()))).toBe(false);
    }

    rmSync(trees.keyRoot, { recursive: true, force: true });
    expect(runTask(a, { title: 'written under a new key' }).ok).toBe(true);
    const verdict = runVerify({ ...a, requirement: 'signed', global: false });
    expect(verdict).toMatchObject({ ok: true, requirementMet: true });
  });
});

describe('a copy read back, and put back', () => {
  /** A project in git with its backup set up and run, and the places a restore is about. */
  function backedUp(label = 'alpha') {
    const a = project(label, true);
    const folder = join(sandbox, `folder-${label}`);
    const set = runBackupSetup(a, folder);
    if (!set.ok) throw new Error('setup refused');
    expect(runBackupRun(a).ok).toBe(true);
    const priv = resolveTrees(a.cwd, env).projectPrivate as string;
    const copy = join(folder, set.record, 'private');
    return { a, folder, record: set.record, priv, copy };
  }
  const tailsOf = (priv: string) => readdirSync(join(priv, 'tails'));
  const segmentOf = (root: string) => {
    const [tail] = readdirSync(join(root, 'tails'));
    return join(root, 'tails', tail as string, '000001.jsonl');
  };

  it('puts a deleted private tree back, writes nothing on a dry run, and goes on beside the restored tail', () => {
    const { a, priv } = backedUp();
    const before = tailsOf(priv);
    rmSync(priv, { recursive: true, force: true });

    const dry = runBackupRestore(a, true);
    expect(dry).toMatchObject({ ok: true, dryRun: true });
    expect(dry.ok && dry.trees[0]?.placing.length).toBeGreaterThan(0);
    expect(existsSync(priv)).toBe(false);

    const done = runBackupRestore(a, false);
    expect(done.ok && done.trees[0]?.restored?.tails).toEqual(before);
    expect(tailsOf(priv)).toEqual(before);
    // What a copy never holds is never there: the notes that say where a tail ends live in locks/.
    expect(existsSync(join(priv, 'locks'))).toBe(false);
    expect(runBackupVerify(a)).toMatchObject({ ok: true, sound: true });
    expect(runVerify({ ...a, requirement: 'signed', global: false })).toMatchObject({
      ok: true,
      requirementMet: true,
    });
    // The restored tail is not continued: the first write opens one of its own.
    expect(runTask(a, { title: 'after the restore', scope: 'private' }).ok).toBe(true);
    expect(tailsOf(priv)).toHaveLength(before.length + 1);
  });

  it('never brings locks/, an installation id or an anchor back, even from a folder that holds them', () => {
    const { a, priv, copy } = backedUp();
    const before = tailsOf(priv);
    const [fingerprint] = readdirSync(join(copy, 'keys')).map((name) => name.replace('.pub', ''));
    mkdirSync(join(copy, 'locks'), { recursive: true });
    writeFileSync(join(copy, 'locks', `${before[0]}.head`), 'a note of a tail end');
    writeFileSync(join(copy, 'keys', `${fingerprint}.inst`), 'an installation id');
    writeFileSync(join(copy, 'keys', `${fingerprint}.anchor`), 'an anchor');
    rmSync(priv, { recursive: true, force: true });

    expect(runBackupRestore(a, false).ok).toBe(true);
    expect(existsSync(join(priv, 'locks'))).toBe(false);
    expect(filesUnder(join(priv, 'keys')).some((file) => /\.(inst|anchor)$/.test(file))).toBe(
      false,
    );
    expect(runTask(a, { title: 'after the restore', scope: 'private' }).ok).toBe(true);
    expect(tailsOf(priv)).toHaveLength(before.length + 1);
  });

  it('keeps a live file that holds other bytes and a live tail that went further, and names them', () => {
    const { a, priv } = backedUp();
    const proof = join(priv, 'tails', tailsOf(priv)[0] as string, 'tailproof.json');
    writeFileSync(proof, '{"another":"proof"}');
    expect(runTask(a, { title: 'written after the copy', scope: 'private' }).ok).toBe(true);
    const digestBefore = digest(priv);

    const done = runBackupRestore(a, false);
    expect(done.ok).toBe(true);
    if (!done.ok) return;
    expect(done.trees[0]?.kept).toEqual([expect.stringMatching(/tailproof\.json$/)]);
    expect(done.trees[0]?.same.length).toBeGreaterThan(0);
    expect(readFileSync(proof, 'utf-8')).toBe('{"another":"proof"}');
    expect(digest(priv)).toBe(digestBefore);
  });

  it('refuses a tree whose tail the copy is not the start of, whether it was cut or went another way, and changes nothing', () => {
    const { a, priv } = backedUp();
    const segment = segmentOf(priv);
    const whole = readFileSync(segment);
    const before = digest(priv);

    // A fork: the tree's first line is not the copy's.
    const forked = Buffer.from(whole);
    forked[2] = forked[2] === 0x61 ? 0x62 : 0x61;
    writeFileSync(segment, forked);
    const afterFork = digest(priv);
    const fork = runBackupRestore(a, false);
    expect(fork).toMatchObject({ ok: false, code: 'DIVERGED' });
    expect(fork.ok === false && 'message' in fork && fork.message).toMatch(/a fork/);
    expect(digest(priv)).toBe(afterFork);

    // A cut: the tree holds the first line only, which is the start of the copy's.
    const first = whole.subarray(0, whole.indexOf(0x0a) + 1);
    writeFileSync(segment, first);
    const cut = runBackupRestore(a, false);
    expect(cut).toMatchObject({ ok: false, code: 'DIVERGED' });
    expect(cut.ok === false && 'message' in cut && cut.message).toMatch(/a cut tree/);
    expect(readFileSync(segment).equals(first)).toBe(true);
    expect(before).not.toBe('');
  });

  it('names the process of a writer that holds a tail, and writes nothing', () => {
    const { a, priv } = backedUp();
    const tail = tailsOf(priv)[0] as string;
    const before = digest(priv);
    const refused = withTailLock(tailLockPath({ root: priv }, tail), () =>
      runBackupRestore(a, false),
    );
    expect(refused).toMatchObject({ ok: false, code: 'WRITER_HOLDS_TAIL' });
    expect(refused.ok === false && 'message' in refused && refused.message).toContain(
      `process ${process.pid}`,
    );
    expect(digest(priv)).toBe(before);
  });

  it("does not restore another record's copy: by its manifest, nor by the record the tree it would join names", () => {
    const { a, priv, copy, record } = backedUp('alpha');
    const other = backedUp('beta');
    // Beta's private copy where alpha's is, with its own manifest...
    rmSync(copy, { recursive: true, force: true });
    cpSync(other.copy, copy, { recursive: true });
    expect(runBackupRestore(a, false)).toMatchObject({ ok: false, code: 'OTHER_RECORD' });
    // ...and with a manifest that says alpha: the tails name another record than alpha's private tree.
    const manifest = join(copy, 'mnema-backup.json');
    const said = JSON.parse(readFileSync(manifest, 'utf-8')) as { record: string };
    writeFileSync(manifest, JSON.stringify({ ...said, record }));
    expect(runBackupRestore(a, false)).toMatchObject({ ok: false, code: 'OTHER_RECORD' });
    expect(existsSync(priv)).toBe(true);
  });

  it('says a copy that is behind, names a tree that is cut or lost, and a copy a reader refuses', () => {
    const { a, priv, copy } = backedUp();
    expect(runTask(a, { title: 'more', scope: 'private' }).ok).toBe(true);
    const stale = runBackupVerify(a);
    expect(stale).toMatchObject({ ok: true, sound: true });
    const reading =
      stale.ok && stale.trees[0] && 'reading' in stale.trees[0]
        ? stale.trees[0].reading
        : undefined;
    expect(reading?.standing.behind.length).toBeGreaterThan(0);

    const segment = segmentOf(priv);
    const whole = readFileSync(segment);
    writeFileSync(segment, whole.subarray(0, whole.indexOf(0x0a) + 1));
    const cut = runBackupVerify(a);
    expect(cut).toMatchObject({ ok: true, sound: false });

    rmSync(priv, { recursive: true, force: true });
    const lost = runBackupVerify(a);
    expect(lost.ok && lost.sound).toBe(false);

    const copied = segmentOf(copy);
    const bytes = readFileSync(copied);
    bytes[2] = bytes[2] === 0x61 ? 0x62 : 0x61;
    writeFileSync(copied, bytes);
    const broken = runBackupVerify(a);
    expect(broken.ok && broken.sound).toBe(false);
    expect(runBackupRestore(a, false)).toMatchObject({ ok: false, code: 'BROKEN_COPY' });
    expect(existsSync(priv)).toBe(false);
  });

  it('is read by the second reader when it is there, and says when only one read the copy', () => {
    const { a, copy } = backedUp();
    const good = runBackupVerify(a);
    const one =
      good.ok && good.trees[0] && 'reading' in good.trees[0] ? good.trees[0].reading : undefined;
    expect(one?.second).toMatchObject({ ran: true, refused: false, exit: 0 });
    expect(one?.readersDisagree).toBe(false);
    const segment = segmentOf(copy);
    const bytes = readFileSync(segment);
    bytes[2] = bytes[2] === 0x61 ? 0x62 : 0x61;
    writeFileSync(segment, bytes);
    const bad = runBackupVerify(a);
    const two =
      bad.ok && bad.trees[0] && 'reading' in bad.trees[0] ? bad.trees[0].reading : undefined;
    expect(two?.second).toMatchObject({ ran: true, refused: true });
    expect(two?.reader.ok).toBe(false);
  });

  it('refuses to verify or restore where the project has no copy', () => {
    const a = project('alpha', true);
    expect(runBackupSetup(a, join(sandbox, 'empty')).ok).toBe(true);
    expect(runBackupVerify(a)).toMatchObject({ ok: false, code: 'NO_COPY' });
    expect(runBackupRestore(a, false)).toMatchObject({ ok: false, code: 'NO_COPY' });
  });
});
