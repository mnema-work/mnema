/**
 * A LINKED WORKTREE WITH NO RECORD OF ITS OWN IS TOLD WHERE THE RECORD IS, NOT TO FOUND ANOTHER.
 *
 * A record git keeps out of its commits (ADR-613, ADR-630) is not carried into a new worktree,
 * so a read run there found no project and said "Run `mnema init` first": the instruction that
 * would have founded a SECOND record beside the first. The refusal now says that the checkout is a
 * linked worktree and where the main checkout's record is, and keeps the old sentence everywhere
 * it is true: outside a repository, in a worktree whose main checkout holds no record, and in a
 * plain checkout.
 *
 * Driven in real processes inside real git repositories, with and without the record, from the
 * worktree's top and from a folder under it.
 */

import { spawnSync } from 'node:child_process';
import {
  appendFileSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openSession } from '../src/mcp/session.js';
import { runReadRecordTool } from '../src/mcp/tools.js';
import { NO_PROJECT } from '../src/wiring/report.js';
import { GIT_WITHOUT_MAINTENANCE } from './support/git-without-maintenance.js';
import { MNEMA_CLI } from './support/the-cli.js';

let sandbox: string;
let home: string;
let repo: string;
let worktree: string;

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
  return { status: ran.status, out: `${ran.stdout}${ran.stderr}`.trim() };
}

function git(cwd: string, ...args: string[]) {
  const ran = spawnSync('git', args, { cwd, encoding: 'utf-8', env: ENV() });
  return { status: ran.status, out: `${ran.stdout}${ran.stderr}` };
}

/** A repository with one commit, a linked worktree of it, and the record (or not) in the main checkout. */
function setUp(withRecord: boolean): void {
  expect(git(repo, 'init', '-q', '-b', 'main').status).toBe(0);
  writeFileSync(join(repo, 'README.md'), 'x\n');
  expect(git(repo, 'add', 'README.md').status).toBe(0);
  expect(git(repo, 'commit', '-qm', 'first').status).toBe(0);
  if (withRecord) {
    // Kept out of git before it exists: the local record, which a new worktree does not get.
    appendFileSync(join(repo, '.git', 'info', 'exclude'), '.mnema/\n');
    expect(mnema(repo, 'init').status).toBe(0);
  }
  const added = git(repo, 'worktree', 'add', '-q', worktree);
  expect(added.status, added.out).toBe(0);
}

beforeEach(() => {
  sandbox = realpathSync(mkdtempSync(join(tmpdir(), 'mnema-linked-says-where-')));
  home = join(sandbox, 'home');
  repo = join(sandbox, 'repo');
  worktree = join(sandbox, 'wt');
  mkdirSync(home);
  mkdirSync(repo);
});

afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

describe('a read in a linked worktree whose main checkout holds the record', () => {
  it('says where the record is and that init would found a second one', () => {
    setUp(true);
    const said = mnema(worktree, 'status');
    expect(said.status).toBe(1);
    expect(said.out).toContain('linked worktree');
    expect(said.out).toContain(join(repo, '.mnema'));
    expect(said.out).toContain('would found a second record');
    expect(said.out).not.toContain('Run `mnema init` first');
  }, 60_000);

  it('says it from a folder under the worktree too, and for another read', () => {
    setUp(true);
    mkdirSync(join(worktree, 'sub'));
    for (const argv of [['status'], ['brief']]) {
      const said = mnema(join(worktree, 'sub'), ...argv);
      expect(said.status, said.out).toBe(1);
      expect(said.out).toContain(join(repo, '.mnema'));
    }
  }, 60_000);
});

describe('where the main checkout has no record either', () => {
  it('keeps the old sentence in the worktree', () => {
    setUp(false);
    expect(mnema(worktree, 'status').out).toBe(NO_PROJECT);
  }, 60_000);

  it('keeps it in the plain checkout', () => {
    setUp(false);
    expect(mnema(repo, 'status').out).toBe(NO_PROJECT);
  }, 60_000);
});

describe('a read for an id that is not there, in a linked worktree of a committed record', () => {
  const UNKNOWN = '01a1f501-0000-7000-8000-000000000000';

  function committedRecord(): void {
    expect(git(repo, 'init', '-q', '-b', 'main').status).toBe(0);
    expect(mnema(repo, 'init').status).toBe(0);
    expect(git(repo, 'add', '.mnema').status).toBe(0);
    expect(git(repo, 'commit', '-qm', 'found the record').status).toBe(0);
    expect(git(repo, 'worktree', 'add', '-q', worktree).status).toBe(0);
  }

  it('`show` says the main checkout may hold it uncommitted, and a plain checkout does not', () => {
    committedRecord();
    const inWorktree = mnema(worktree, 'show', UNKNOWN);
    expect(inWorktree.status).toBe(1);
    expect(inWorktree.out).toContain('linked worktree');
    expect(inWorktree.out).toContain(`main checkout (${repo})`);
    const inRepo = mnema(repo, 'show', UNKNOWN);
    expect(inRepo.status).toBe(1);
    expect(inRepo.out).not.toContain('linked worktree');
  }, 60_000);

  it('`read_record` says the same in a worktree and not in a plain checkout', () => {
    committedRecord();
    const env = { home };
    const read = (dir: string) => {
      const session = openSession({
        clientName: 'agent-alpha',
        roots: [pathToFileURL(dir).href],
        env,
      });
      return JSON.stringify(runReadRecordTool(session, { id: UNKNOWN }));
    };
    expect(read(worktree)).toContain('linked worktree');
    expect(read(worktree)).toContain(`main checkout (${repo})`);
    expect(read(repo)).not.toContain('linked worktree');
  }, 60_000);
});
