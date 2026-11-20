/**
 * `mnema backup`: two projects on one machine, each with its own folder, and what a run of one
 * of them puts where. The engine's own rules (what is copied, what is refused) are the core's
 * (`topology/backup/copy.test.ts`); what is held here is the PROJECT: whose folder is whose,
 * and that no folder is inherited.
 */

// @plants-damage
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
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
import { recordNamedIn, tailLockPath, UnreadableDiskError, withTailLock } from '@mnema/chain';
import {
  asidePlaceInGit,
  asidesIn,
  type DiscoveryEnv,
  privateTreesLeftBehind,
  resolveTrees,
} from '@mnema/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  globalAsides,
  planBackupRestore,
  runBackupRestore,
  runBackupRun,
  runBackupSetup,
  runBackupStatus,
  runBackupUndo,
  runBackupVerify,
  runGlobalBackupRun,
  runGlobalBackupSetup,
  runGlobalBackupStatus,
  runGlobalBackupVerify,
  runGlobalRestore,
  runGlobalUndo,
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

  it("turns away a copy that disagrees with itself, and asks about another record's: by the record the tree it would join names", () => {
    const { a, priv, copy, record } = backedUp('alpha');
    const other = backedUp('beta');
    // Beta's private copy where alpha's is, with a manifest that says beta in a folder that says alpha...
    rmSync(copy, { recursive: true, force: true });
    cpSync(other.copy, copy, { recursive: true });
    expect(runBackupRestore(a, false)).toMatchObject({ ok: false, code: 'OTHER_RECORD' });
    // ...and with a manifest that says alpha: the tails name another record than alpha's private tree, which is asked.
    const manifest = join(copy, 'mnema-backup.json');
    const said = JSON.parse(readFileSync(manifest, 'utf-8')) as { record: string };
    writeFileSync(manifest, JSON.stringify({ ...said, record }));
    expect(runBackupRestore(a, false)).toMatchObject({ ok: false, code: 'NOT_CONFIRMED' });
    expect(runBackupRestore(a, true)).toMatchObject({ ok: true, dryRun: true });
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

  it('fails verify for a manifest that does not read, and only says one that is not there', () => {
    const { a, copy } = backedUp();
    const manifest = join(copy, 'mnema-backup.json');
    const whole = readFileSync(manifest);
    writeFileSync(manifest, '{"files": ');
    const unreadable = runBackupVerify(a);
    expect(unreadable.ok && unreadable.sound).toBe(false);
    const reading =
      unreadable.ok && unreadable.trees[0] && 'reading' in unreadable.trees[0]
        ? unreadable.trees[0].reading
        : undefined;
    expect(reading?.manifest).toBe('unreadable');
    rmSync(manifest);
    const absent = runBackupVerify(a);
    expect(absent).toMatchObject({ ok: true, sound: true });
    writeFileSync(manifest, whole);
    expect(runBackupVerify(a)).toMatchObject({ ok: true, sound: true });
  });

  it('refuses to restore a copy whose manifest does not read, and says it in status; a manifest that is not there only is said', () => {
    const { a, priv, copy } = backedUp();
    const manifest = join(copy, 'mnema-backup.json');
    const whole = readFileSync(manifest);
    rmSync(priv, { recursive: true, force: true });
    for (const broken of ['{"files": ', '[]']) {
      writeFileSync(manifest, broken);
      const refused = runBackupRestore(a, false);
      expect(refused).toMatchObject({ ok: false, code: 'BROKEN_COPY' });
      expect(refused.ok === false && 'message' in refused && refused.message).toContain(manifest);
      expect(existsSync(priv)).toBe(false);
    }
    // A manifest the disk refuses (a folder where the file should be) does not read either.
    rmSync(manifest);
    mkdirSync(manifest);
    expect(runBackupRestore(a, false)).toMatchObject({ ok: false, code: 'BROKEN_COPY' });
    expect(existsSync(priv)).toBe(false);
    const status = runBackupStatus(a);
    expect(status.ok && status.trees.some((one) => one.manifest === 'unreadable')).toBe(true);
    // Not there at all: restored, and the copy says it has no date.
    rmSync(manifest, { recursive: true });
    expect(runBackupRestore(a, false)).toMatchObject({ ok: true });
    expect(existsSync(priv)).toBe(true);
    writeFileSync(manifest, whole);
  });

  it('refuses to verify or restore where the project has no copy', () => {
    const a = project('alpha', true);
    expect(runBackupSetup(a, join(sandbox, 'empty')).ok).toBe(true);
    expect(runBackupVerify(a)).toMatchObject({ ok: false, code: 'NO_COPY' });
    expect(runBackupRestore(a, false)).toMatchObject({ ok: false, code: 'NO_COPY' });
  });
});

describe("a copy of another record's, with a question and a way back", () => {
  /** Alpha, set up with the folder beta's copy is in, and beta's record. */
  function alphaWithBetasCopy(inGit: boolean) {
    const a = project('alpha', inGit);
    const b = project('beta', inGit);
    const folder = join(sandbox, 'folder-beta');
    const set = runBackupSetup(b, folder);
    if (!set.ok) throw new Error('setup refused');
    expect(runBackupRun(b).ok).toBe(true);
    expect(runBackupSetup(a, folder).ok).toBe(true);
    const trees = resolveTrees(a.cwd, env);
    return { a, b, folder, beta: set.record, trees, priv: trees.projectPrivate as string };
  }
  const porcelain = (cwd: string) =>
    spawnSync('git', ['status', '--porcelain'], {
      cwd,
      env: { PATH: process.env.PATH ?? '', HOME: sandbox, GIT_CONFIG_GLOBAL: '/dev/null' },
    }).stdout.toString();
  const T1 = new Date('2026-11-12T23:36:30Z');
  const T2 = new Date('2026-11-12T23:40:00Z');

  describe.skipIf(process.platform === 'win32' || process.getuid?.() === 0)(
    'a tails folder of the live tree the disk will not open',
    () => {
      it.each([true, false])(
        'names the part and refuses the restore of another record, with the project in git: %s',
        (inGit) => {
          const { a, trees, beta } = alphaWithBetasCopy(inGit);
          const tails = join(trees.projectPublic as string, 'tails');
          const live = digest(trees.projectPublic as string);
          chmodSync(tails, 0);
          try {
            expect(() => runBackupRestore(a, false, { from: beta, confirmed: true })).toThrow(
              UnreadableDiskError,
            );
            expect(() => planBackupRestore(a, beta)).toThrow(/tails cannot be opened/);
          } finally {
            chmodSync(tails, 0o700);
          }
          expect(digest(trees.projectPublic as string)).toBe(live);
          expect(existsSync(join(sandbox, 'home', '.mnema', 'before-restore'))).toBe(false);
        },
      );
    },
  );

  it('asks first, keeps the live tree in the git directory, puts the copy in, and --undo puts the live tree back as it was', () => {
    const { a, trees, priv, beta } = alphaWithBetasCopy(true);
    const live = digest(priv);
    const status = porcelain(a.cwd);

    // Without a yes nothing is done, and a dry run only says it.
    expect(runBackupRestore(a, false, { from: beta })).toMatchObject({
      ok: false,
      code: 'NOT_CONFIRMED',
    });
    const dry = runBackupRestore(a, true, { from: beta });
    expect(dry).toMatchObject({ ok: true, dryRun: true, keptAside: undefined });
    expect(digest(priv)).toBe(live);
    expect(asidesIn(asidePlaceInGit(join(a.cwd, '.git')))).toEqual([]);

    const done = runBackupRestore(a, false, { from: beta, confirmed: true, now: T1 });
    if (!done.ok) throw new Error(JSON.stringify(done));
    const folder = join(a.cwd, '.git', 'mnema', 'before-restore-2026-11-12T23-36-30Z');
    expect(done.keptAside?.folder).toBe(folder);
    // The live tree, whole, and never in the working tree: git sees no new file.
    expect(digest(join(folder, 'private'))).toBe(live);
    expect(porcelain(a.cwd)).toBe(status);
    expect(digest(priv)).not.toBe(live);
    expect(readdirSync(join(priv, 'tails'))).toHaveLength(1);
    // The folder is not a project: the private tree of this one is where it was.
    expect(resolveTrees(a.cwd, env).projectPrivate).toBe(trees.projectPrivate);
    expect(privateTreesLeftBehind(a.cwd)?.left).toEqual([]);

    const undone = runBackupUndo(a);
    expect(undone).toMatchObject({ ok: true, trees: ['private'] });
    expect(digest(priv)).toBe(live);
    expect(porcelain(a.cwd)).toBe(status);
    // What stood in the place was kept, not deleted, and a second undo has nothing to put back.
    expect(existsSync(join(folder, 'restored-private', 'tails'))).toBe(true);
    expect(runBackupUndo(a)).toMatchObject({ ok: false, code: 'NOTHING_TO_UNDO' });
  });

  it('keeps every folder it set aside: no restore deletes one, --undo goes newest first and says how many remain, and status lists them', () => {
    const { a, beta, priv } = alphaWithBetasCopy(true);
    const live = digest(priv);
    const first = runBackupRestore(a, false, { from: beta, confirmed: true, now: T1 });
    expect(first).toMatchObject({ ok: true, asides: [expect.anything()] });
    const second = runBackupRestore(a, false, { from: beta, confirmed: true, now: T2 });
    const one = join(a.cwd, '.git', 'mnema', 'before-restore-2026-11-12T23-36-30Z');
    const two = join(a.cwd, '.git', 'mnema', 'before-restore-2026-11-12T23-40-00Z');
    expect(second.ok && second.asides.map((kept) => kept.folder)).toEqual([one, two]);
    expect(existsSync(one) && existsSync(two)).toBe(true);
    const status = runBackupStatus(a);
    expect(status.ok && status.asides.map((kept) => kept.folder)).toEqual([one, two]);
    expect(status.ok && status.asides[0]?.bytes).toBeGreaterThan(0);

    const back = runBackupUndo(a);
    expect(back).toMatchObject({ ok: true, folder: two, others: 1 });
    expect(runBackupUndo(a)).toMatchObject({ ok: true, folder: one, others: 1 });
    expect(digest(priv)).toBe(live);
    // What an undo moved aside is a folder the person has to delete too: status lists it, and no more asks it to be put back.
    const after = runBackupStatus(a);
    expect(
      after.ok && after.asides.map((kept) => [kept.folder, kept.trees, kept.restored]),
    ).toEqual([
      [one, [], ['private']],
      [two, [], ['private']],
    ]);
    expect(after.ok && after.asides.every((kept) => kept.bytes > 0)).toBe(true);
    expect(runBackupUndo(a)).toMatchObject({ ok: false, code: 'NOTHING_TO_UNDO' });
  });

  it("does not delete this project's folder when another project of the repository restores", () => {
    const { a, beta } = alphaWithBetasCopy(true);
    const kept = runBackupRestore(a, false, { from: beta, confirmed: true, now: T1 });
    if (!kept.ok) throw new Error('refused');
    const nested = join(a.cwd, 'nested');
    mkdirSync(nested);
    runInit({ cwd: nested, env });
    const n = { cwd: nested, env };
    expect(runTask(n, { title: 'work', scope: 'private' }).ok).toBe(true);
    const folder = join(sandbox, 'folder-nested');
    expect(runBackupSetup(n, folder).ok).toBe(true);
    expect(runBackupRun(n).ok).toBe(true);
    expect(runBackupRestore(n, false)).toMatchObject({ ok: true });
    expect(existsSync(kept.keptAside?.folder as string)).toBe(true);
  });

  it('keeps the place of a project in git where it was: the git directory, and nothing in the mnema home', () => {
    const { a, beta } = alphaWithBetasCopy(true);
    expect(runBackupRestore(a, false, { from: beta, confirmed: true, now: T1 }).ok).toBe(true);
    expect(existsSync(join(a.cwd, '.git', 'mnema', 'before-restore-2026-11-12T23-36-30Z'))).toBe(
      true,
    );
    expect(existsSync(join(sandbox, 'home', '.mnema', 'before-restore'))).toBe(false);
  });

  describe('where the project is outside git: the folder is in the mnema home', () => {
    const home = () => join(sandbox, 'home', '.mnema');

    it('asks first, keeps both trees in <home>/before-restore/<date>/, and --undo puts them back byte for byte', () => {
      const { a, beta, trees } = alphaWithBetasCopy(false);
      const root = trees.projectPublic as string;
      const live = digest(root);
      const plan = planBackupRestore(a, beta);
      expect(plan.ok && plan.keptIn).toContain(join(home(), 'before-restore'));
      expect(plan.ok && plan.keeping.map((one) => one.tree)).toEqual(['private', 'public']);

      expect(runBackupRestore(a, false, { from: beta })).toMatchObject({
        ok: false,
        code: 'NOT_CONFIRMED',
      });
      expect(digest(root)).toBe(live);
      expect(existsSync(join(home(), 'before-restore'))).toBe(false);

      const done = runBackupRestore(a, false, { from: beta, confirmed: true, now: T1 });
      if (!done.ok) throw new Error(JSON.stringify(done));
      const folder = join(home(), 'before-restore', '2026-11-12T23-36-30Z');
      expect(done.keptAside).toMatchObject({ folder, trees: ['private', 'public'] });
      // The live record, whole: the public tree as it stood without the private one inside it, and the private one.
      expect(digest(join(folder, 'public')) + digest(join(folder, 'private'))).not.toBe('');
      expect(digest(root)).not.toBe(live);
      expect(resolveTrees(a.cwd, env).projectPublic).toBe(root);

      expect(runBackupUndo(a)).toMatchObject({ ok: true, trees: ['private', 'public'] });
      expect(digest(root)).toBe(live);
      expect(existsSync(join(folder, 'restored-public', 'tails'))).toBe(true);
      expect(existsSync(join(folder, 'restored-private', 'tails'))).toBe(true);
      expect(runBackupUndo(a)).toMatchObject({ ok: false, code: 'NOTHING_TO_UNDO' });
    });

    it('keeps every folder: a second restore keeps both, --undo puts back the newest, and status lists them', () => {
      const { a, beta, trees } = alphaWithBetasCopy(false);
      const live = digest(trees.projectPublic as string);
      expect(runBackupRestore(a, false, { from: beta, confirmed: true, now: T1 }).ok).toBe(true);
      expect(runBackupUndo(a).ok).toBe(true);
      const second = runBackupRestore(a, false, { from: beta, confirmed: true, now: T2 });
      const one = join(home(), 'before-restore', '2026-11-12T23-36-30Z');
      const two = join(home(), 'before-restore', '2026-11-12T23-40-00Z');
      expect(second.ok && second.asides.map((kept) => kept.folder)).toEqual([one, two]);
      expect(existsSync(one) && existsSync(two)).toBe(true);
      const listed = runBackupStatus(a);
      expect(listed.ok && listed.asides.map((kept) => kept.folder)).toEqual([one, two]);
      expect(listed.ok && listed.asides.every((kept) => kept.bytes > 0)).toBe(true);
      expect(runBackupUndo(a)).toMatchObject({ ok: true, folder: two, others: 1 });
      expect(digest(trees.projectPublic as string)).toBe(live);
      // Nothing deleted: both folders are still there for the person to delete.
      expect(existsSync(one) && existsSync(two)).toBe(true);
    });

    it('makes no before-restore folder for a restore that moves nothing aside', () => {
      const a = project('alpha', false);
      expect(runBackupSetup(a, join(sandbox, 'folder-own')).ok).toBe(true);
      expect(runBackupRun(a).ok).toBe(true);
      expect(runBackupRestore(a, false)).toMatchObject({ ok: true });
      expect(existsSync(join(home(), 'before-restore'))).toBe(false);
    });

    it('takes one lock for the place, and asking to undo where nothing was kept does not make the place', () => {
      const { a, beta } = alphaWithBetasCopy(false);
      expect(runBackupUndo(a)).toMatchObject({ ok: false, code: 'NOTHING_TO_UNDO' });
      expect(existsSync(join(home(), 'before-restore'))).toBe(false);
      const lock = join(home(), 'restoring.lock');
      expect(
        withTailLock(lock, () =>
          runBackupRestore(a, false, { from: beta, confirmed: true, now: T1 }),
        ),
      ).toMatchObject({ ok: false, code: 'RESTORE_RUNNING' });
      expect(withTailLock(lock, () => runBackupUndo(a))).toMatchObject({
        code: 'RESTORE_RUNNING',
      });
    });

    it('is not a project, a tree or a key to anything that reads the home', () => {
      const { a, beta, trees } = alphaWithBetasCopy(false);
      runBackupRestore(a, false, { from: beta, confirmed: true, now: T1 });
      const folder = join(home(), 'before-restore', '2026-11-12T23-36-30Z');
      // Standing inside the kept folder finds no project, and the trees of the real one are where they were.
      expect(resolveTrees(join(folder, 'public'), env).projectPublic).toBeUndefined();
      expect(resolveTrees(a.cwd, env)).toMatchObject({
        projectPublic: trees.projectPublic,
        global: join(home(), 'global'),
        keyRoot: join(home(), 'identity'),
      });
      // The agents' folder lists names that are agents; the kept folder is not one.
      expect(readdirSync(home())).toContain('before-restore');
      expect(readdirSync(join(home(), 'identity'))).not.toContain('before-restore');
    });
  });

  it('names, for each tree, the record the tree to be replaced holds, and says the truth of a public tree with several', () => {
    const { a, beta } = alphaWithBetasCopy(true);
    const before = planBackupRestore(a, beta);
    expect(before.ok && before.holds).toEqual([
      { tree: 'private', says: expect.stringMatching(/^the record [0-9a-f]{64}$/) },
    ]);
    const held = before.ok ? before.holds[0]?.says : '';
    runBackupRestore(a, false, { from: beta, confirmed: true, now: T1 });
    const after = planBackupRestore(a, beta);
    // The private tree now holds the copy's own record, and the question says so, not the project's.
    expect(after.ok && after.holds[0]?.says).not.toBe(held);
    expect(after.ok && after.holds[0]?.says).toContain(beta === '' ? '' : 'the record');
  });

  it('says what the public tails are when the project has no name: none, or several records', () => {
    const g = project('gamma', false);
    const folder = join(sandbox, 'folder-gamma');
    expect(runBackupSetup(g, folder).ok).toBe(true);
    const tails = join(g.cwd, '.mnema', 'tails');
    const [tail] = readdirSync(tails);
    rmSync(tails, { recursive: true, force: true });
    const none = runBackupRestore(g, false);
    expect(none.ok === false && 'message' in none && none.message).toContain(
      'holds no tail that names a record',
    );
    const other = project('delta', false);
    cpSync(join(other.cwd, '.mnema', 'tails'), tails, { recursive: true });
    cpSync(join(g.cwd, '.mnema', 'private', 'tails'), join(tails, 'x'), { recursive: true });
    expect(tail).toBeDefined();
    const said = runBackupRestore(g, false);
    expect(said).toMatchObject({ ok: false });
    expect(said.ok === false && 'message' in said && said.message).not.toContain(
      'its tails are gone',
    );
  });

  it('counts a dry run as the restore will count, with the kept tree already gone', () => {
    const { a, beta } = alphaWithBetasCopy(true);
    const dry = runBackupRestore(a, true, { from: beta });
    const real = runBackupRestore(a, false, { from: beta, confirmed: true, now: T1 });
    expect(dry.ok && real.ok && dry.trees.map((t) => t.placing.length)).toEqual(
      real.ok ? real.trees.map((t) => t.restored?.files) : [],
    );
  });

  it('takes one lock for every restore and every undo of the repository, whichever kind is held against which', () => {
    const { a, beta, priv } = alphaWithBetasCopy(true);
    const lock = join(a.cwd, '.git', 'mnema', 'restoring.lock');
    const live = digest(priv);
    // A restore that asks, while another holds the repository.
    expect(
      withTailLock(lock, () =>
        runBackupRestore(a, false, { from: beta, confirmed: true, now: T1 }),
      ),
    ).toMatchObject({ ok: false, code: 'RESTORE_RUNNING' });
    expect(asidesIn(asidePlaceInGit(join(a.cwd, '.git')))).toEqual([]);
    expect(digest(priv)).toBe(live);
    // A restore of the project's own copy, which asks nothing, holds the same lock: so does one that is held against it.
    expect(runBackupRun(a).ok).toBe(true);
    expect(withTailLock(lock, () => runBackupRestore(a, false))).toMatchObject({
      ok: false,
      code: 'RESTORE_RUNNING',
    });
    expect(withTailLock(lock, () => runBackupUndo(a))).toMatchObject({ code: 'RESTORE_RUNNING' });
    // And the one that asks is held off by a restore that is writing: the writer holds the repository lock too.
    expect(runBackupRestore(a, false)).toMatchObject({ ok: true });
  });

  describe('where the public tree lost its tails and the project has no name', () => {
    /** A project without git, backed up, whose public tails are then gone. */
    function nameless(label = 'gamma') {
      const g = project(label, false);
      const folder = join(sandbox, `folder-${label}`);
      const set = runBackupSetup(g, folder);
      if (!set.ok) throw new Error('setup refused');
      expect(runBackupRun(g).ok).toBe(true);
      const publicTails = join(g.cwd, '.mnema', 'tails');
      rmSync(publicTails, { recursive: true, force: true });
      expect(recordNamedIn([join(g.cwd, '.mnema')]).state).not.toBe('named');
      return { g, folder, record: set.record, publicTails };
    }

    it('takes the name from the copy, asks, and restores only with a yes', () => {
      const { g, record, publicTails } = nameless();
      expect(runBackupVerify(g)).toMatchObject({ ok: false, reason: 'NO_RECORD_NAME' });
      const asked = runBackupRestore(g, false);

      expect(asked).toMatchObject({ ok: false, code: 'NOT_CONFIRMED' });
      expect(existsSync(publicTails)).toBe(false);
      const dry = runBackupRestore(g, true);
      expect(dry).toMatchObject({ ok: true, dryRun: true, copyRecord: record });
      expect(existsSync(publicTails)).toBe(false);

      const done = runBackupRestore(g, false, { confirmed: true });
      expect(done).toMatchObject({ ok: true, copyRecord: record, keptAside: undefined });
      expect(existsSync(publicTails)).toBe(true);
      expect(recordNamedIn([join(g.cwd, '.mnema')])).toMatchObject({
        state: 'named',
        name: record,
      });
      expect(runBackupVerify(g)).toMatchObject({ ok: true, sound: true });
    });

    it('says so when this machine has no copy to take the name from', () => {
      const { g, folder } = nameless();
      rmSync(folder, { recursive: true, force: true });
      const refused = runBackupRestore(g, false, { confirmed: true });
      expect(refused).toMatchObject({ ok: false, reason: 'NO_RECORD_NAME' });
      expect(refused.ok === false && 'message' in refused && refused.message).toContain('no copy');
    });

    it('does not guess among several copies, and says the command that names one', () => {
      const { g, record } = nameless();
      const other = project('delta', false);
      expect(runBackupSetup(other, join(sandbox, 'folder-delta')).ok).toBe(true);
      expect(runBackupRun(other).ok).toBe(true);
      const refused = runBackupRestore(g, false, { confirmed: true });
      expect(refused).toMatchObject({ ok: false, reason: 'NO_RECORD_NAME' });
      expect(refused.ok === false && 'message' in refused && refused.message).toContain('--from');
      expect(runBackupRestore(g, true, { from: record })).toMatchObject({ ok: true });
    });
  });
});

describe("the machine's global tree, put back from its copy", () => {
  const T1 = new Date('2026-11-12T23:36:30Z');
  const T2 = new Date('2026-11-12T23:40:00Z');

  /** A machine of its own (its own mnema home) with a project in it and a task in the global tree. */
  function machine(label: string) {
    const home = join(sandbox, `${label}-home`);
    const cwd = join(sandbox, label);
    mkdirSync(cwd, { recursive: true });
    const ctx = { cwd, env: { home } };
    runInit(ctx);
    expect(runTask(ctx, { title: `work of ${label}` }).ok).toBe(true);
    expect(runTask(ctx, { title: `private work of ${label}`, scope: 'private' }).ok).toBe(true);
    expect(runTask(ctx, { title: `memory of ${label}`, scope: 'global' }).ok).toBe(true);
    const trees = resolveTrees(cwd, ctx.env);
    return { ctx, home: join(home, '.mnema'), trees, global: trees.global };
  }

  /** Alpha's machine, set up with the folder beta's global copy is in. */
  function alphaWithBetasGlobalCopy() {
    const a = machine('alpha');
    const b = machine('beta');
    const folder = join(sandbox, 'folder-beta');
    expect(runGlobalBackupSetup(b.ctx, folder).ok).toBe(true);
    expect(runGlobalBackupRun(b.ctx).ok).toBe(true);
    expect(runGlobalBackupSetup(a.ctx, folder).ok).toBe(true);
    return { a, b, folder };
  }

  /** What each tree of a project holds, as a person's tree hash: the same bytes, the same names. */
  const projectTrees = (m: ReturnType<typeof machine>) =>
    digest(m.trees.projectPublic as string) + digest(m.trees.projectPrivate as string);

  it('restores its own copy without overwriting what the tree has written since, and says so', () => {
    const a = machine('alpha');
    const folder = join(sandbox, 'folder-alpha');
    expect(runGlobalBackupSetup(a.ctx, folder).ok).toBe(true);
    expect(runGlobalBackupRun(a.ctx).ok).toBe(true);
    expect(runTask(a.ctx, { title: 'written after the copy', scope: 'global' }).ok).toBe(true);
    const live = digest(a.global);
    const done = runGlobalRestore(a.ctx, false);
    if (!done.ok) throw new Error(JSON.stringify(done));
    expect(done).toMatchObject({ global: true, keptAside: undefined });
    expect(done.trees.map((one) => one.tree)).toEqual(['global']);
    // The live tree went further than the copy: it is kept, and the outcome says which file.
    expect(done.trees[0]?.liveWins.some((path) => path.startsWith('tails/'))).toBe(true);
    expect(digest(a.global)).toBe(live);
    expect(existsSync(join(a.home, 'before-restore'))).toBe(false);
  });

  it('puts back a global tree that lost its tails, never over a file, and a dry run writes nothing', () => {
    const a = machine('alpha');
    expect(runGlobalBackupSetup(a.ctx, join(sandbox, 'folder-alpha')).ok).toBe(true);
    expect(runGlobalBackupRun(a.ctx).ok).toBe(true);
    const tails = join(a.global, 'tails');
    const names = readdirSync(tails);
    const tailsBefore = digest(tails);
    rmSync(tails, { recursive: true });
    const lost = digest(a.global);
    const dry = runGlobalRestore(a.ctx, true);
    expect(dry).toMatchObject({ ok: true, dryRun: true });
    expect(digest(a.global)).toBe(lost);
    expect(existsSync(join(a.home, 'before-restore'))).toBe(false);
    expect(runGlobalRestore(a.ctx, false)).toMatchObject({ ok: true, dryRun: false });
    expect(readdirSync(tails)).toEqual(names);
    expect(digest(a.global)).not.toBe(lost);
    expect(digest(tails)).toBe(tailsBefore);
  });

  it("asks about another machine's copy, keeps the live tree in the home, puts the copy in, and --undo brings every byte back", () => {
    const { a, b } = alphaWithBetasGlobalCopy();
    const liveGlobal = digest(a.global);
    const liveProjects = projectTrees(a);
    const betas = readdirSync(join(b.global, 'tails'));

    expect(runGlobalRestore(a.ctx, false)).toMatchObject({ ok: false, code: 'NOT_CONFIRMED' });
    expect(digest(a.global)).toBe(liveGlobal);
    expect(existsSync(join(a.home, 'before-restore'))).toBe(false);
    const dry = runGlobalRestore(a.ctx, true);
    expect(dry).toMatchObject({ ok: true, dryRun: true, global: true, keptAside: undefined });
    expect(digest(a.global)).toBe(liveGlobal);
    expect(existsSync(join(a.home, 'before-restore'))).toBe(false);

    const done = runGlobalRestore(a.ctx, false, { confirmed: true, now: T1 });
    if (!done.ok) throw new Error(JSON.stringify(done));
    const folder = join(a.home, 'before-restore', '2026-11-12T23-36-30Z');
    expect(done.keptAside).toMatchObject({ folder, trees: ['global'] });
    // The live global tree, whole and byte for byte, in the folder; the copy's tails in the tree.
    expect(digest(join(folder, 'global'))).toBe(liveGlobal);
    expect(readdirSync(join(a.global, 'tails')).sort()).toEqual(betas.sort());
    // No tree of a project was touched, and the key root stayed.
    expect(projectTrees(a)).toBe(liveProjects);
    expect(existsSync(join(a.home, 'identity'))).toBe(true);

    const undone = runGlobalUndo(a.ctx);
    expect(undone).toMatchObject({ ok: true, trees: ['global'], folder });
    expect(digest(a.global)).toBe(liveGlobal);
    expect(projectTrees(a)).toBe(liveProjects);
    // What stood in the place was kept, and nothing was deleted.
    expect(existsSync(join(folder, 'restored-global', 'tails'))).toBe(true);
    expect(runGlobalUndo(a.ctx)).toMatchObject({ ok: false, code: 'NOTHING_TO_UNDO' });
  });

  it("is never touched by a project's restore of another record's copy", () => {
    const gamma = project('gamma', false);
    expect(runBackupSetup(gamma, join(sandbox, 'folder-gamma')).ok).toBe(true);
    expect(runBackupRun(gamma).ok).toBe(true);
    const record = (runBackupSetup(gamma, join(sandbox, 'folder-gamma')) as { record: string })
      .record;
    const d = machine('delta');
    expect(runBackupSetup(d.ctx, join(sandbox, 'folder-gamma')).ok).toBe(true);
    const liveGlobal = digest(d.global);
    const done = runBackupRestore(d.ctx, false, { from: record, confirmed: true, now: T1 });
    expect(done).toMatchObject({ ok: true, global: false });
    // The project's trees were replaced and kept aside; the machine's global tree was not touched.
    expect(digest(join(d.home, 'before-restore', '2026-11-12T23-36-30Z', 'public'))).not.toBe('');
    expect(digest(d.global)).toBe(liveGlobal);
    expect(runBackupUndo(d.ctx).ok).toBe(true);
    expect(digest(d.global)).toBe(liveGlobal);
  });

  it('lists what it kept aside in status, and says each one stays until it is deleted', () => {
    const { a } = alphaWithBetasGlobalCopy();
    expect(runGlobalRestore(a.ctx, false, { confirmed: true, now: T1 }).ok).toBe(true);
    expect(runGlobalBackupStatus(a.ctx)).toMatchObject({
      ok: true,
      asides: [{ date: '2026-11-12T23-36-30Z', trees: ['global'] }],
    });
    expect(runGlobalUndo(a.ctx).ok).toBe(true);
    expect(runGlobalRestore(a.ctx, false, { confirmed: true, now: T2 }).ok).toBe(true);
    const listed = runGlobalBackupStatus(a.ctx);
    expect(listed.ok && listed.asides.map((kept) => kept.date)).toEqual([
      '2026-11-12T23-36-30Z',
      '2026-11-12T23-40-00Z',
    ]);
    // A project of this machine does not list it as its own.
    const status = runBackupStatus(a.ctx);
    expect(status.ok ? status.asides : []).toEqual([]);
  });

  it('says the global tree, not a project, where nothing was kept aside or a restore is running', () => {
    const { a } = alphaWithBetasGlobalCopy();
    const none = runGlobalUndo(a.ctx);
    expect(none).toMatchObject({ ok: false, code: 'NOTHING_TO_UNDO' });
    expect(none.ok === false && 'message' in none && none.message).toContain('for the global tree');
    expect(none.ok === false && 'message' in none && none.message).not.toContain('project');
    const busy = withTailLock(join(a.home, 'restoring.lock'), () => runGlobalUndo(a.ctx));
    expect(busy).toMatchObject({ code: 'RESTORE_RUNNING' });
    expect(busy.ok === false && 'message' in busy && busy.message).toContain('the global tree');
    expect(busy.ok === false && 'message' in busy && busy.message).not.toContain('project');
  });

  it('lists what was kept aside even where the global tree has no destination', () => {
    const { a } = alphaWithBetasGlobalCopy();
    expect(runGlobalRestore(a.ctx, false, { confirmed: true, now: T1 }).ok).toBe(true);
    rmSync(join(a.home, 'backup.json'));
    expect(runGlobalBackupStatus(a.ctx)).toMatchObject({
      ok: false,
      reason: 'NO_GLOBAL_DESTINATION',
    });
    expect(globalAsides(a.ctx).map((kept) => kept.date)).toEqual(['2026-11-12T23-36-30Z']);
  });

  it('reads the copy of the global tree as a record, and says where there is none', () => {
    const a = machine('alpha');
    expect(runGlobalBackupVerify(a.ctx)).toMatchObject({
      ok: false,
      reason: 'NO_GLOBAL_DESTINATION',
    });
    expect(runGlobalRestore(a.ctx, false)).toMatchObject({
      ok: false,
      reason: 'NO_GLOBAL_DESTINATION',
    });
    expect(runGlobalBackupSetup(a.ctx, join(sandbox, 'folder-alpha')).ok).toBe(true);
    expect(runGlobalBackupVerify(a.ctx)).toMatchObject({ ok: false, code: 'NO_COPY' });
    expect(runGlobalRestore(a.ctx, false)).toMatchObject({ ok: false, code: 'NO_COPY' });
    expect(runGlobalBackupRun(a.ctx).ok).toBe(true);
    expect(runGlobalBackupVerify(a.ctx)).toMatchObject({
      ok: true,
      sound: true,
      record: undefined,
    });
  });
});
