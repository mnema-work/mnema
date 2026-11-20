/**
 * `mnema doctor --fix private-tree` OVER AN ALTERED ENTRY: the door asks about the tree the relink WRITES INTO (the
 * shared private tree, the destination), at the writer it opens there, and about nothing else. The tree left behind
 * in the worktree is read by the relink itself, which refuses a tail that does not verify with its own words: the
 * door does not reach into it, so the refusal is not the altered-entry one and says nothing of `tail repair`.
 *
 *   - an entry of the destination altered: the fix is refused `ALTERED_ENTRY`, and neither tree has a byte more or less;
 *   - an entry of the tree left behind altered: the fix is refused by the relink (`TAIL_DOES_NOT_VERIFY`), not by the
 *     door, and neither tree has a byte more or less.
 */
// @plants-damage
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GIT_WITHOUT_MAINTENANCE } from './support/git-without-maintenance.js';
import { MNEMA_CLI } from './support/the-cli.js';

let sandbox: string;
let home: string;
let repo: string;
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
  return { status: ran.status, out: `${ran.stdout}${ran.stderr}` };
}
function git(cwd: string, ...args: string[]) {
  const ran = spawnSync('git', args, {
    cwd,
    encoding: 'utf-8',
    env: { ...ENV(), GIT_CONFIG_GLOBAL: GIT_WITHOUT_MAINTENANCE },
  });
  return { status: ran.status, out: `${ran.stdout}${ran.stderr}` };
}
const shared = () => join(repo, '.git', 'mnema', '%2E', 'private');
const oldTree = () => join(repo, '.mnema', 'private');

function firstSegment(root: string): string {
  const tails = join(root, 'tails');
  return join(tails, readdirSync(tails)[0] as string, '000001.jsonl');
}

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'mnema-relink-door-'));
  home = join(sandbox, 'home');
  repo = join(sandbox, 'repo');
  mkdirSync(home);
  mkdirSync(repo);
  expect(git(repo, 'init', '-q', '-b', 'main').status).toBe(0);
  expect(mnema(repo, 'init').status).toBe(0);
  expect(git(repo, 'add', '.mnema').status).toBe(0);
  expect(git(repo, 'commit', '-qm', 'found the record').status).toBe(0);
  expect(mnema(repo, 'memory', '--scope', 'private', 'in the repository').status).toBe(0);
  renameSync(join(repo, '.git'), join(repo, '.git.aside'));
  try {
    expect(mnema(repo, 'memory', '--scope', 'private', 'founded apart').status).toBe(0);
  } finally {
    renameSync(join(repo, '.git.aside'), join(repo, '.git'));
  }
});
afterEach(() => rmSync(sandbox, { recursive: true, force: true }));

/** Every file under `dir` but the cache a read keeps in `locks/`, by path and bytes: what a refusal must leave as it was. */
function everythingUnder(dir: string): string {
  const files = readdirSync(dir, { recursive: true, encoding: 'utf-8' })
    .filter((path) => !path.startsWith('locks') && statSync(join(dir, path)).isFile())
    .sort();
  const hash = createHash('sha256');
  for (const path of files)
    hash
      .update(path)
      .update('\0')
      .update(readFileSync(join(dir, path)));
  return `${files.length} file(s), ${hash.digest('hex')}`;
}

/** The first line the text names, swapped for another: an entry altered after it was written. */
function alter(root: string, from: string): void {
  const file = firstSegment(root);
  const text = readFileSync(file, 'utf-8');
  expect(text).toContain(from);
  writeFileSync(file, text.replace(from, 'something else'));
}

describe('the fix of the private tree over an altered entry', () => {
  it('is refused by the door where the destination holds the altered entry, and moves nothing', () => {
    alter(shared(), 'in the repository');
    const before = [everythingUnder(oldTree()), everythingUnder(shared())];
    const ran = mnema(repo, 'doctor', '--fix', 'private-tree');
    expect(ran.status, ran.out).not.toBe(0);
    expect(ran.out).toContain('Refused (ALTERED_ENTRY)');
    expect([everythingUnder(oldTree()), everythingUnder(shared())]).toEqual(before);
  });

  it('is refused by the relink, not the door, where only the tree left behind holds it, and moves nothing', () => {
    alter(oldTree(), 'founded apart');
    const before = [everythingUnder(oldTree()), everythingUnder(shared())];
    const ran = mnema(repo, 'doctor', '--fix', 'private-tree');
    expect(ran.status, ran.out).not.toBe(0);
    expect(ran.out).toContain('TAIL_DOES_NOT_VERIFY');
    expect(ran.out).not.toContain('ALTERED_ENTRY');
    expect([everythingUnder(oldTree()), everythingUnder(shared())]).toEqual(before);
  });
});
