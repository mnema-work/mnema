/**
 * `mnema backup` at the surface: the confirmation `setup` asks before it assigns a folder, what
 * `run` says it copied, and what `status` says and gives as JSON.
 */

// @plants-damage
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveTrees } from '@mnema/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type CliIo, run } from '../program.js';
import { KEPT_IN_CLEAR, WHAT_RESTORE_DOES_NOT_BRING } from './backup.js';

let sandbox: string;
let repo: string;
let originalCwd: string;
let originalHome: string | undefined;

interface Said {
  readonly out: string[];
  readonly err: string[];
  readonly failed: boolean;
}

async function mnema(argv: string[], io: Partial<CliIo> = {}): Promise<Said> {
  const out: string[] = [];
  const err: string[] = [];
  let failed = false;
  await run(argv, {
    out: (line) => out.push(line),
    err: (line) => err.push(line),
    fail: () => {
      failed = true;
    },
    ...io,
  });
  return { out, err, failed };
}

beforeEach(async () => {
  sandbox = mkdtempSync(join(tmpdir(), 'mnema-backup-verb-'));
  repo = join(sandbox, 'repo');
  mkdirSync(repo, { recursive: true });
  originalCwd = process.cwd();
  originalHome = process.env.HOME;
  process.env.HOME = join(sandbox, 'home');
  delete process.env.MNEMA_HOME;
  process.chdir(repo);
  const founded = await mnema(['init']);
  expect(founded.failed, founded.err.join(' / ')).toBe(false);
  const recorded = await mnema([
    'decision',
    'record',
    'A choice',
    'a reason',
    '--scope',
    'private',
  ]);
  expect(recorded.failed, recorded.err.join(' / ')).toBe(false);
});

afterEach(() => {
  process.chdir(originalCwd);
  if (originalHome === undefined) delete process.env.HOME;
  else process.env.HOME = originalHome;
  rmSync(sandbox, { recursive: true, force: true });
});

/** What a person at a terminal answers. */
const answering = (answer: string): Partial<CliIo> => ({
  aPersonIsHere: true,
  ask: async () => answer,
});

describe('mnema backup setup', () => {
  it('assigns nothing where an answer can be read but no person is at a terminal (a pipe)', async () => {
    const folder = join(sandbox, 'folder');
    const said = await mnema(['backup', 'setup', folder], { ask: async () => 'yes' });
    expect(said.failed).toBe(true);
    expect(existsSync(join(sandbox, 'home', '.mnema', 'backup.json'))).toBe(false);
  });

  it('assigns nothing without a terminal, with a flag that would answer or without, and says the command for a person', async () => {
    const folder = join(sandbox, 'folder');
    for (const argv of [
      ['backup', 'setup', folder],
      ['backup', 'setup', '--yes', folder],
    ]) {
      const said = await mnema(argv);
      expect(said.failed, argv.join(' ')).toBe(true);
      expect(existsSync(join(sandbox, 'home', '.mnema', 'backup.json'))).toBe(false);
    }
    const said = await mnema(['backup', 'setup', folder]);
    expect(said.err.join(' ')).toContain('keeps the text in clear');
    expect(said.err.join(' ')).toContain('in a terminal');
    expect(said.err.join(' ')).not.toContain('--yes');
  });

  it('asks the person, says the sentence, and assigns only on yes', async () => {
    const folder = join(sandbox, 'folder');
    const asked: string[] = [];
    const asking = (answer: string): Partial<CliIo> => ({
      aPersonIsHere: true,
      ask: async (question) => {
        asked.push(question);
        return answer;
      },
    });
    const no = await mnema(['backup', 'setup', folder], asking('no'));
    expect(no.out.join('\n')).toContain(KEPT_IN_CLEAR);
    expect(existsSync(join(sandbox, 'home', '.mnema', 'backup.json'))).toBe(false);
    const yes = await mnema(['backup', 'setup', folder], asking('Yes'));
    expect(yes.failed, yes.err.join(' / ')).toBe(false);
    expect(asked).toHaveLength(2);
    expect(existsSync(join(sandbox, 'home', '.mnema', 'backup.json'))).toBe(true);
  });
});

describe('mnema backup run and status', () => {
  it('copies the trees of a project with no git, and says the copy is up to date', async () => {
    const folder = join(sandbox, 'folder');
    expect((await mnema(['backup', 'setup', folder], answering('yes'))).failed).toBe(false);
    const ran = await mnema(['backup', 'run']);
    expect(ran.failed, ran.err.join(' / ')).toBe(false);
    expect(ran.out.join('\n')).toMatch(/private tree: \d+ file\(s\) held/);
    expect(readdirSync(folder)).toHaveLength(1);

    const status = await mnema(['backup', 'status']);
    expect(status.out.join('\n')).toContain('nothing to add');
    expect(status.out.join('\n')).toContain('the private key is not copied');

    const json = await mnema(['backup', 'status', '--json']);
    const reading = JSON.parse(json.out.join('\n')) as { destination: string; trees: unknown[] };
    expect(reading.destination).toBe(folder);
    expect(reading.trees).toHaveLength(2);
  });

  it('says what a second setup replaced, and that a project has no private tree yet', async () => {
    const first = join(sandbox, 'first');
    const second = join(sandbox, 'second');
    await mnema(['backup', 'setup', first], answering('yes'));
    const again = await mnema(['backup', 'setup', second], answering('yes'));
    expect(again.out.join('\n')).toContain(`it was ${first}`);
    const trees = resolveTrees(repo, { home: join(sandbox, 'home') });
    rmSync(trees.projectPrivate as string, { recursive: true, force: true });
    const ran = await mnema(['backup', 'run']);
    expect(ran.out.join('\n')).toContain('private tree: none on this machine yet');
    const status = await mnema(['backup', 'status']);
    expect(status.out.join('\n')).toContain('private tree: none on this machine yet');
  });

  it('refuses a run for a project with no folder', async () => {
    const said = await mnema(['backup', 'run']);
    expect(said.failed).toBe(true);
    expect(said.err.join(' ')).toContain('mnema backup setup <folder>');
  });
});

describe('mnema backup --global', () => {
  const home = () => join(sandbox, 'home', '.mnema', 'backup.json');

  it('assigns nothing without a terminal, and names the global command for the person', async () => {
    const said = await mnema(['backup', 'setup', '--global', join(sandbox, 'g')]);
    expect(said.failed).toBe(true);
    expect(said.err.join(' ')).toContain('mnema backup setup --global <folder>');
    expect(existsSync(home())).toBe(false);
  });

  it('copies only the global tree to its folder, and says the project run did not', async () => {
    await mnema(['task', 'create', 'memory', '--scope', 'global']);
    const folder = join(sandbox, 'g');
    expect((await mnema(['backup', 'setup', '--global', folder], answering('yes'))).failed).toBe(
      false,
    );
    const refused = await mnema(['backup', 'run']);
    expect(refused.err.join(' ')).toContain('mnema backup setup <folder>');
    expect(existsSync(folder)).toBe(false);

    const ran = await mnema(['backup', 'run', '--global']);
    expect(ran.failed, ran.err.join(' / ')).toBe(false);
    expect(ran.out.join('\n')).toMatch(/global tree: \d+ file\(s\) held/);
    expect(readdirSync(folder)).toEqual(['global']);

    const status = await mnema(['backup', 'status', '--global']);
    expect(status.out.join('\n')).toContain('global tree: last copied');
    expect(status.out.join('\n')).toContain('nothing to add');
    const json = JSON.parse(
      (await mnema(['backup', 'status', '--global', '--json'])).out.join('\n'),
    );
    expect(json.destination).toBe(folder);
  });

  it('refuses a global run for a machine whose global tree has no folder', async () => {
    const said = await mnema(['backup', 'run', '--global']);
    expect(said.failed).toBe(true);
    expect(said.err.join(' ')).toContain('mnema backup setup --global <folder>');
  });
});

describe('mnema backup verify and restore', () => {
  it('puts a deleted private tree back, says what a restore does not bring, and verifies the result', async () => {
    const folder = join(sandbox, 'folder');
    await mnema(['backup', 'setup', folder], answering('yes'));
    expect((await mnema(['backup', 'run'])).failed).toBe(false);
    const trees = resolveTrees(repo, { home: join(sandbox, 'home') });
    rmSync(trees.projectPrivate as string, { recursive: true, force: true });

    const lost = await mnema(['backup', 'verify']);
    expect(lost.failed).toBe(true);
    expect(lost.out.join('\n')).toMatch(/is in the copy and not in the tree/);

    const dry = await mnema(['backup', 'restore', '--dry-run']);
    expect(dry.failed, dry.err.join(' / ')).toBe(false);
    expect(dry.out.join('\n')).toContain('Dry run: nothing was written');
    expect(existsSync(trees.projectPrivate as string)).toBe(false);

    const restored = await mnema(['backup', 'restore']);
    expect(restored.failed, restored.err.join(' / ')).toBe(false);
    const said = restored.out.join('\n');
    // The key is not in the copy, and the restore says so in words that promise nothing about it.
    for (const words of WHAT_RESTORE_DOES_NOT_BRING) expect(said).toContain(words);
    expect(said).toContain('counts you twice');
    expect(said).not.toMatch(/restores? (your|the) key/);

    const verified = await mnema(['backup', 'verify']);
    expect(verified.failed, verified.out.join(' / ')).toBe(false);
    expect(verified.out.join('\n')).toContain('the copy is as far as the tree');
    expect(verified.out.join('\n')).toContain('ONE reader read this copy');
    const json = JSON.parse((await mnema(['backup', 'verify', '--json'])).out.join('\n')) as {
      sound: boolean;
    };
    expect(json.sound).toBe(true);
  });

  it('names what it finds: a copy behind, a tree that went further, a file kept, a tree cut or forked, a manifest that lists more', async () => {
    const folder = join(sandbox, 'folder');
    await mnema(['backup', 'setup', folder], answering('yes'));
    await mnema(['backup', 'run']);
    const trees = resolveTrees(repo, { home: join(sandbox, 'home') });
    const priv = trees.projectPrivate as string;
    const [tail] = readdirSync(join(priv, 'tails'));
    const segment = join(priv, 'tails', tail as string, '000001.jsonl');
    const whole = readFileSync(segment);
    const copyDir = join(folder, readdirSync(folder)[0] as string, 'private');

    await mnema(['task', 'create', 'written after the copy', '--scope', 'private']);
    const behind = await mnema(['backup', 'verify']);
    expect(behind.failed).toBe(false);
    expect(behind.out.join('\n')).toContain('the copy is BEHIND');

    writeFileSync(join(priv, 'tails', tail as string, 'tailproof.json'), '{"other":true}');
    const goingOn = await mnema(['backup', 'restore']);
    expect(goingOn.failed, goingOn.err.join(' / ')).toBe(false);
    expect(goingOn.out.join('\n')).toContain('holds more in the tree than in the copy');
    expect(goingOn.out.join('\n')).toContain('holds other bytes in the tree');

    const manifest = join(copyDir, 'mnema-backup.json');
    const listed = JSON.parse(readFileSync(manifest, 'utf-8')) as { files: { bytes: number }[] };
    writeFileSync(
      manifest,
      JSON.stringify({
        ...listed,
        files: listed.files.map((f) => ({ ...f, bytes: f.bytes + 99 })),
      }),
    );
    const missing = await mnema(['backup', 'verify']);
    expect(missing.out.join('\n')).toContain('is listed by the copy');
    writeFileSync(manifest, JSON.stringify(listed));

    writeFileSync(segment, whole.subarray(0, whole.indexOf(0x0a) + 1));
    const cut = await mnema(['backup', 'verify']);
    expect(cut.failed).toBe(true);
    expect(cut.out.join('\n')).toContain('the tree is cut');

    const forked = Buffer.from(whole);
    forked[2] = forked[2] === 0x61 ? 0x62 : 0x61;
    writeFileSync(segment, forked);
    const fork = await mnema(['backup', 'verify']);
    expect(fork.failed).toBe(true);
    expect(fork.out.join('\n')).toContain('a fork, or a cut, and no side is taken');
    const refused = await mnema(['backup', 'restore']);
    expect(refused.failed).toBe(true);
    expect(refused.err.join(' ')).toContain('do not agree');
    rmSync(priv, { recursive: true, force: true });
    const gone = await mnema(['backup', 'verify']);
    expect(gone.out.join('\n')).toContain('is in the copy and not in the tree');
  });

  it('refuses where the project has no folder for its backup', async () => {
    for (const argv of [
      ['backup', 'verify'],
      ['backup', 'restore'],
    ]) {
      const said = await mnema(argv);
      expect(said.failed).toBe(true);
      expect(said.err.join(' ')).toContain('mnema backup setup <folder>');
    }
  });
});
