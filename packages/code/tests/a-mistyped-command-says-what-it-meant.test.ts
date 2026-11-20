import { execFileSync } from 'node:child_process';
import { appendFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { run } from '../src/program.js';

/**
 * Small answers that used to say a no or a fact without saying what the person most likely
 * meant: each is a sentence a caller reads once and acts on, so each is pinned by the words it
 * must carry.
 */

let sandbox: string;
let repo: string;
let originalCwd: string;
let originalXdg: string | undefined;
let originalHome: string | undefined;

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'mnema-meant-'));
  repo = join(sandbox, 'project');
  mkdirSync(repo, { recursive: true });
  mkdirSync(join(sandbox, 'home'), { recursive: true });
  originalCwd = process.cwd();
  originalXdg = process.env.XDG_DATA_HOME;
  originalHome = process.env.HOME;
  process.env.XDG_DATA_HOME = join(sandbox, 'data');
  process.env.HOME = join(sandbox, 'home');
  delete process.env.MNEMA_RUN;
  process.chdir(repo);
});

afterEach(() => {
  process.chdir(originalCwd);
  if (originalXdg === undefined) delete process.env.XDG_DATA_HOME;
  else process.env.XDG_DATA_HOME = originalXdg;
  if (originalHome === undefined) delete process.env.HOME;
  else process.env.HOME = originalHome;
  rmSync(sandbox, { recursive: true, force: true });
});

async function mnema(...argv: string[]): Promise<{ out: string; err: string; failed: boolean }> {
  const out: string[] = [];
  const err: string[] = [];
  let failed = false;
  await run(argv, {
    out: (line) => out.push(line),
    err: (line) => err.push(line),
    fail: () => {
      failed = true;
    },
  });
  return { out: out.join('\n'), err: err.join('\n'), failed };
}

const idOf = (text: string): string => {
  const found = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/.exec(text);
  if (found === null) throw new Error(`no id in ${text}`);
  return found[0];
};

describe('a mistyped command says what it meant', () => {
  it('decision move <id> accept says the action goes before the id', async () => {
    await mnema('init');
    const said = await mnema('decision', 'move', 'ADR-1', 'accept');
    expect(said.failed).toBe(true);
    expect(said.err).toContain('The action goes before the id: mnema decision move accept <id>.');
  });

  it('observe given the topic as a word names --topic and --text', async () => {
    await mnema('init');
    const said = await mnema('observe', 'ADR-1', 'cli0', '--topic', 't');
    expect(said.failed).toBe(true);
    expect(said.err).toContain('does not take "cli0"');
    expect(said.err).toContain('--topic <label> and --text <text>');
  });

  it('memory given two words says it takes one text', async () => {
    await mnema('init');
    const said = await mnema('memory', 'one', 'two');
    expect(said.failed).toBe(true);
    expect(said.err).toContain('It takes one text');
  });

  it('decision list points at search and status', async () => {
    await mnema('init');
    const said = await mnema('decision', 'list');
    expect(said.failed).toBe(true);
    expect(said.err).toContain('put `record` before its title');
    expect(said.err).toContain('mnema search --kind decision');
    expect(said.err).toContain('mnema status');
  });
});

describe('what a write says about where it landed', () => {
  function git(...args: string[]): void {
    execFileSync('git', args, { cwd: repo, stdio: 'ignore' });
  }

  it('says the record stays on this machine when git excludes it and tracks nothing', async () => {
    git('init', '-q');
    appendFileSync(join(repo, '.git', 'info', 'exclude'), '\n.mnema/\n');
    await mnema('init');
    const said = await mnema('memory', 'a note for this machine only');
    expect(said.out).toContain('Landed in the public tree: git ignores .mnema/ here');
    expect(said.out).toContain('stays on this machine');
    expect(said.out).not.toContain('reaches every clone');
  });

  const LOCAL = 'stays on this machine';
  const COMMITTED = 'reaches every clone';

  it('counts an excluded record as committed when a file under it is tracked', async () => {
    git('init', '-q');
    appendFileSync(join(repo, '.git', 'info', 'exclude'), '\n.mnema/\n');
    await mnema('init');
    git('add', '-f', '.mnema');
    const said = await mnema('memory', 'a note for a record that is tracked after all');
    expect(said.out).toContain(COMMITTED);
    expect(said.out).not.toContain(LOCAL);
  });

  it('says nothing about staying here when git cannot be run', async () => {
    git('init', '-q');
    appendFileSync(join(repo, '.git', 'info', 'exclude'), '\n.mnema/\n');
    await mnema('init');
    const path = process.env.PATH;
    process.env.PATH = join(sandbox, 'no-such-bin');
    try {
      const said = await mnema('memory', 'a note while git is out of reach');
      expect(said.out).not.toContain(LOCAL);
    } finally {
      if (path === undefined) delete process.env.PATH;
      else process.env.PATH = path;
    }
  });

  it('reads the repository from a subdirectory of it', async () => {
    git('init', '-q');
    appendFileSync(join(repo, '.git', 'info', 'exclude'), '\n.mnema/\n');
    await mnema('init');
    mkdirSync(join(repo, 'src', 'deep'), { recursive: true });
    process.chdir(join(repo, 'src', 'deep'));
    const said = await mnema('memory', 'a note from a subdirectory');
    expect(said.out).toContain(LOCAL);
  });

  it('notices when the exclusion changes while the process lives', async () => {
    git('init', '-q');
    appendFileSync(join(repo, '.git', 'info', 'exclude'), '\n.mnema/\n');
    await mnema('init');
    expect((await mnema('memory', 'first, excluded')).out).toContain(LOCAL);
    writeFileSync(join(repo, '.git', 'info', 'exclude'), '# nothing is excluded now, and longer\n');
    expect((await mnema('memory', 'second, no longer excluded')).out).toContain(COMMITTED);
  });

  it('still says it reaches every clone when the record is not excluded', async () => {
    git('init', '-q');
    await mnema('init');
    const said = await mnema('memory', 'a note for the team');
    expect(said.out).toContain('committed with the repository, so it reaches every clone');
  });
});

describe('a search hit that left force says so', () => {
  it('names the state, and for a superseded one the decision that replaced it', async () => {
    await mnema('init');
    const first = await mnema('decision', 'record', 'Use the old wiki', 'it was there');
    const second = await mnema('decision', 'record', 'Use the new wiki', 'it is better');
    const rejected = await mnema('decision', 'record', 'Use paper notes', 'quiet');
    await mnema('decision', 'move', 'accept', idOf(first.out), '--note', 'ok');
    await mnema('decision', 'move', 'accept', idOf(second.out), '--note', 'ok');
    await mnema('decision', 'move', 'reject', idOf(rejected.out), '--note', 'no');
    await mnema(
      'decision',
      'supersede',
      idOf(first.out),
      idOf(second.out),
      '--reason',
      'the new wiki replaces it',
    );
    const found = await mnema('search', 'wiki', '--kind', 'decision');
    expect(found.out).toMatch(/Use the old wiki.*superseded/);
    expect(found.out).toContain(idOf(second.out));
    const paper = await mnema('search', 'paper', '--kind', 'decision');
    expect(paper.out).toMatch(/Use paper notes.*rejected/);
  });
});
