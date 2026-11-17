/**
 * `mnema backup` at the surface: the confirmation `setup` asks before it assigns a folder, what
 * `run` says it copied, and what `status` says and gives as JSON.
 */

import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveTrees } from '@mnema/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type CliIo, run } from '../program.js';
import { KEPT_IN_CLEAR } from './backup.js';

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
