// @plants-damage
/**
 * What a tail's notes and lock outlive: the checkout they were written in.
 *
 * THE DEFECT, MEASURED ON THE BINARY. The note of what this machine wrote last to a tail, its
 * lock and the id that names the tail all lived inside the checkout, ignored by git. `git clean
 * -fdX` deleted them and the next write opened a tail of its own, saying nothing: a tail more
 * for every clean, and a worktree of the repository never saw what any other had written.
 *
 * Inside a repository the notes and the lock now live under the common git directory, which every
 * worktree shares and no clean touches, and each worktree keeps a hint of its id under its own git
 * directory. What a reader of the record sees is unchanged.
 */

import { spawn, spawnSync } from 'node:child_process';
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
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
  return { status: ran.status, out: `${ran.stdout}${ran.stderr}`, err: ran.stderr ?? '' };
}

function git(cwd: string, ...args: string[]) {
  const ran = spawnSync('git', args, {
    cwd,
    encoding: 'utf-8',
    env: { ...ENV(), GIT_CONFIG_GLOBAL: GIT_WITHOUT_MAINTENANCE },
  });
  return { status: ran.status, out: `${ran.stdout}${ran.stderr}` };
}

/** Where the notes and the lock of every tail of the project at the top of `repo` live. */
function shared(): string {
  return join(repo, '.git', 'mnema', '%2E', 'public');
}

function tails(of: string = repo): string[] {
  return readdirSync(join(of, '.mnema', 'tails')).sort();
}

/** The tail the checkout at `of` writes and the fingerprint of the key that names it. */
function theTail(of: string = repo): { tail: string; fingerprint: string; id: string } {
  const [tail] = tails(of);
  const fingerprint = (tail as string).split('-')[0] as string;
  return { tail: tail as string, fingerprint, id: (tail as string).slice(fingerprint.length + 1) };
}

/** The hint of the installation id a checkout keeps under its own git directory. */
function hintOf(gitDir: string, fingerprint: string): string {
  return join(gitDir, 'mnema', '%2E', 'public', 'keys', `${fingerprint}.inst`);
}

/** Everything that was committed stays; the record is committed as a project's is. */
function commitTheRecord(message: string): void {
  expect(git(repo, 'add', '.mnema').status).toBe(0);
  expect(git(repo, 'commit', '-qm', message, '--allow-empty').status).toBe(0);
}

/**
 * The state an earlier mnema left a checkout in: the id in the record's own `keys/`, the notes in
 * its own `locks/`, and no mark that anything was moved.
 */
function leaveItAsAnEarlierMnemaDid(): { tail: string; fingerprint: string; id: string } {
  const { tail, fingerprint, id } = theTail();
  const legacyLocks = join(repo, '.mnema', 'locks');
  mkdirSync(legacyLocks, { recursive: true });
  for (const name of readdirSync(join(shared(), 'locks'))) {
    if (name.startsWith(`${tail}.`))
      renameSync(join(shared(), 'locks', name), join(legacyLocks, name));
  }
  mkdirSync(join(repo, '.mnema', 'keys'), { recursive: true });
  renameSync(
    hintOf(join(repo, '.git'), fingerprint),
    join(repo, '.mnema', 'keys', `${fingerprint}.inst`),
  );
  rmSync(join(shared(), 'migrated'), { recursive: true, force: true });
  return { tail, fingerprint, id };
}

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'mnema-a-new-checkout-'));
  home = join(sandbox, 'home');
  repo = join(sandbox, 'repo');
  mkdirSync(home);
  mkdirSync(repo);
  expect(git(repo, 'init', '-q', '-b', 'main').status).toBe(0);
  expect(mnema(repo, 'init').status).toBe(0);
});

afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

describe('where a tail keeps its notes, its lock and its id inside a repository', () => {
  it('puts the notes under the common git directory and the id under this checkout’s own, and nothing of either in .mnema/', () => {
    const wrote = mnema(repo, 'memory', 'the first note');
    expect(wrote.status, wrote.out).toBe(0);
    const [tail] = tails();
    expect(tails()).toHaveLength(1);

    const notes = readdirSync(join(shared(), 'locks'));
    expect(notes).toContain(`${tail}.head`);
    expect(notes).toContain(`${tail}.head.sig`);
    const fingerprint = (tail as string).split('-')[0] as string;
    expect(readFileSync(join(shared(), 'keys', `${fingerprint}.inst`), 'utf-8').trim()).toBe(
      (tail as string).slice(fingerprint.length + 1),
    );

    // The record's own `locks/` holds the projection a reader keeps, and nothing a writer notes.
    const left = existsSync(join(repo, '.mnema', 'locks'))
      ? readdirSync(join(repo, '.mnema', 'locks'))
      : [];
    expect(left.filter((name) => name.startsWith(`${tail}.`))).toEqual([]);
    expect(existsSync(join(repo, '.mnema', 'keys', `${fingerprint}.inst`))).toBe(false);
  }, 120_000);
});

describe('a clean of what git ignores', () => {
  it('goes on writing the same tail, and says nothing', () => {
    expect(mnema(repo, 'memory', 'before the clean').status).toBe(0);
    expect(git(repo, 'add', '.mnema').status).toBe(0);
    expect(git(repo, 'commit', '-qm', 'the record').status).toBe(0);
    const before = tails();

    const cleaned = git(repo, 'clean', '-fdXq');
    expect(cleaned.status, cleaned.out).toBe(0);

    const wrote = mnema(repo, 'memory', 'after the clean');
    expect(wrote.status, wrote.out).toBe(0);
    expect(wrote.out).not.toContain('wrote to a new tail');
    expect(tails()).toEqual(before);
    const verified = mnema(repo, 'verify');
    expect(verified.status, verified.out).toBe(0);
  }, 120_000);
});

describe('a write over a place that holds a symbolic link', () => {
  it('refuses a locks directory that is one, by name, and writes nothing through it', () => {
    expect(mnema(repo, 'memory', 'the first note').status).toBe(0);
    const outside = join(sandbox, 'outside');
    mkdirSync(outside);
    rmSync(join(shared(), 'locks'), { recursive: true });
    symlinkSync(outside, join(shared(), 'locks'), 'dir');

    const wrote = mnema(repo, 'memory', 'through the link');
    expect(wrote.status).not.toBe(0);
    expect(wrote.out).toContain('is a symbolic link');
    expect(wrote.out).toContain(join(shared(), 'locks'));
    expect(readdirSync(outside)).toEqual([]);
  }, 120_000);

  it('refuses a note that is one, and leaves what it points at as it was', () => {
    expect(mnema(repo, 'memory', 'the first note').status).toBe(0);
    const [tail] = tails();
    const target = join(sandbox, 'elsewhere.head');
    writeFileSync(target, 'untouched\n');
    const note = join(shared(), 'locks', `${tail}.head`);
    rmSync(note);
    symlinkSync(target, note);

    const wrote = mnema(repo, 'memory', 'through the note');
    expect(wrote.status).not.toBe(0);
    expect(wrote.out).toContain('is a symbolic link');
    expect(readFileSync(target, 'utf-8')).toBe('untouched\n');
  }, 120_000);
});

describe('a worktree of the repository', () => {
  it('keeps its hint under its own git directory and its notes in the shared place, and takes none of them away when it goes', () => {
    commitTheRecord('the record');
    expect(mnema(repo, 'memory', 'from the checkout').status).toBe(0);
    commitTheRecord('the checkout wrote');
    const worktree = join(sandbox, 'wt');
    const added = git(repo, 'worktree', 'add', '-q', worktree);
    expect(added.status, added.out).toBe(0);

    const wrote = mnema(worktree, 'memory', 'from the worktree');
    expect(wrote.status, wrote.out).toBe(0);
    // A worktree with no hint of its own writes a tail of its own, as it always did; what changes
    // is where it notes it, and that the note outlives it.
    const own = tails(worktree).filter((tail) => !tails(repo).includes(tail));
    expect(own).toHaveLength(1);
    const { fingerprint } = theTail(worktree);
    const gitDir = join(repo, '.git', 'worktrees', 'wt');
    expect(existsSync(hintOf(gitDir, fingerprint))).toBe(true);
    expect(existsSync(join(worktree, '.mnema', 'keys', `${fingerprint}.inst`))).toBe(false);
    expect(readdirSync(join(shared(), 'locks'))).toContain(`${own[0]}.head`);

    const removed = git(repo, 'worktree', 'remove', '--force', worktree);
    expect(removed.status, removed.out).toBe(0);
    expect(existsSync(hintOf(gitDir, fingerprint))).toBe(false);
    expect(readdirSync(join(shared(), 'locks'))).toContain(`${own[0]}.head`);
  }, 120_000);

  it('is not given a git directory again when it is gone: it writes as a project in no repository does', () => {
    commitTheRecord('the record');
    const worktree = join(sandbox, 'wt');
    expect(git(repo, 'worktree', 'add', '-q', worktree).status).toBe(0);
    rmSync(join(repo, '.git', 'worktrees', 'wt'), { recursive: true });
    const notes = readdirSync(join(shared(), 'locks')).sort();

    const wrote = mnema(worktree, 'memory', 'from a worktree git no longer knows');
    expect(wrote.status, wrote.out).toBe(0);
    // Nothing is made where git looks for worktrees, and nothing is noted in the shared place for it.
    expect(existsSync(join(repo, '.git', 'worktrees', 'wt'))).toBe(false);
    expect(readdirSync(join(shared(), 'locks')).sort()).toEqual(notes);
  }, 120_000);

  it('goes on with a tail another worktree copied the hint of under one lock, which a holder of it keeps', () => {
    // A worktree started from a commit that holds the tail, and given the id of it: the shape an
    // id copied into another checkout has, which the notes and the lock are there to hold.
    expect(mnema(repo, 'memory', 'the first note').status).toBe(0);
    commitTheRecord('the record');
    const { tail, fingerprint } = theTail();
    const worktree = join(sandbox, 'wt');
    expect(git(repo, 'worktree', 'add', '-q', worktree).status).toBe(0);
    const gitDir = join(repo, '.git', 'worktrees', 'wt');
    mkdirSync(join(gitDir, 'mnema', '%2E', 'public', 'keys'), { recursive: true });
    copyFileSync(hintOf(join(repo, '.git'), fingerprint), hintOf(gitDir, fingerprint));

    // The lock a writer of the checkout holds in the middle of an append, in the one place both take it.
    const lock = join(shared(), 'locks', `${tail}.lock`);
    writeFileSync(lock, `${process.pid} ${Date.now()}\n`, 'utf-8');
    const waited = mnema(worktree, 'memory', 'while the other holds the tail');
    rmSync(lock);

    expect(waited.status).not.toBe(0);
    expect(waited.out).toContain('TAIL_BUSY');
    expect(waited.out).toContain(lock);
    expect(tails(worktree)).toEqual([tail]);
  }, 120_000);

  it('writes in turn with another that went on with the same tail, with no line between and no fork after the merge', async () => {
    expect(mnema(repo, 'memory', 'the first note').status).toBe(0);
    commitTheRecord('the record');
    git(repo, 'branch', 'second');
    const { fingerprint } = theTail();
    const worktree = join(sandbox, 'wt');
    expect(git(repo, 'worktree', 'add', '-q', worktree, 'second').status).toBe(0);
    const gitDir = join(repo, '.git', 'worktrees', 'wt');
    mkdirSync(join(gitDir, 'mnema', '%2E', 'public', 'keys'), { recursive: true });
    copyFileSync(hintOf(join(repo, '.git'), fingerprint), hintOf(gitDir, fingerprint));

    const run = (cwd: string, label: string) =>
      new Promise<number | null>((done) => {
        const child = spawn(process.execPath, [MNEMA_CLI, 'memory', label], {
          cwd,
          env: ENV(),
          stdio: 'ignore',
        });
        child.on('close', done);
      });
    const writers = async (cwd: string, label: string) => {
      const codes: (number | null)[] = [];
      for (let i = 0; i < 12; i += 1) codes.push(await run(cwd, `${label} ${i}`));
      return codes;
    };
    const [a, b] = await Promise.all([
      writers(repo, 'main side'),
      writers(worktree, 'second side'),
    ]);
    expect([...a, ...b].every((code) => code === 0)).toBe(true);

    for (const [at, branch] of [
      [repo, 'main'],
      [worktree, 'second'],
    ] as const) {
      expect(mnema(at, 'verify').status, `verify on ${branch}`).toBe(0);
      expect(git(at, 'add', '.mnema').status).toBe(0);
      expect(git(at, 'commit', '-qm', `${branch} wrote`).status).toBe(0);
    }
    const merged = git(repo, 'merge', '--no-edit', 'second');
    expect(merged.status, merged.out).toBe(0);
    const verified = mnema(repo, 'verify');
    expect(verified.status, verified.out).toBe(0);
  }, 240_000);
});

describe('what an earlier mnema left in the record itself', () => {
  it('is moved at the first write, and the write goes on with the same tail and says nothing', () => {
    expect(mnema(repo, 'memory', 'written by the earlier mnema').status).toBe(0);
    const { tail, fingerprint } = leaveItAsAnEarlierMnemaDid();

    const wrote = mnema(repo, 'memory', 'written by this one');
    expect(wrote.status, wrote.out).toBe(0);
    expect(wrote.out).not.toContain('wrote to a new tail');
    expect(tails()).toEqual([tail]);

    expect(readdirSync(join(shared(), 'locks'))).toEqual(
      expect.arrayContaining([`${tail}.head`, `${tail}.head.sig`]),
    );
    const left = existsSync(join(repo, '.mnema', 'locks'))
      ? readdirSync(join(repo, '.mnema', 'locks'))
      : [];
    expect(left.filter((name) => name.startsWith(`${tail}.`))).toEqual([]);
    expect(existsSync(join(repo, '.mnema', 'keys', `${fingerprint}.inst`))).toBe(false);
    expect(existsSync(hintOf(join(repo, '.git'), fingerprint))).toBe(true);
    expect(existsSync(join(shared(), 'migrated', fingerprint))).toBe(true);
    expect(mnema(repo, 'verify').status).toBe(0);
  }, 120_000);

  it('is finished by the next write when an interruption left it half moved, at every step', () => {
    // Step by step the move leaves: the notes in the shared place and the id still in the record;
    // then the hint kept as well, the id still in the record; the mark is never there until the end.
    for (const stopped of ['after the notes', 'after the hint']) {
      expect(mnema(repo, 'memory', `before ${stopped}`).status).toBe(0);
      const { tail, fingerprint, id } = leaveItAsAnEarlierMnemaDid();
      for (const name of readdirSync(join(repo, '.mnema', 'locks'))) {
        if (name.startsWith(`${tail}.`)) {
          renameSync(join(repo, '.mnema', 'locks', name), join(shared(), 'locks', name));
        }
      }
      if (stopped === 'after the hint') {
        mkdirSync(join(repo, '.git', 'mnema', '%2E', 'public', 'keys'), { recursive: true });
        writeFileSync(hintOf(join(repo, '.git'), fingerprint), `${id}\n`);
      }

      const wrote = mnema(repo, 'memory', `finished ${stopped}`);
      expect(wrote.status, wrote.out).toBe(0);
      expect(wrote.out).not.toContain('wrote to a new tail');
      expect(tails(), stopped).toEqual([tail]);
      expect(existsSync(join(repo, '.mnema', 'keys', `${fingerprint}.inst`)), stopped).toBe(false);
      expect(existsSync(join(shared(), 'migrated', fingerprint)), stopped).toBe(true);
    }
    expect(mnema(repo, 'verify').status).toBe(0);
  }, 180_000);

  it('retires the tail where the shared place already holds another note of it, and forks nothing', () => {
    expect(mnema(repo, 'memory', 'written by the earlier mnema').status).toBe(0);
    const { tail } = leaveItAsAnEarlierMnemaDid();
    // The shared place holds a note of the same tail that says something else: one of the two is
    // older than where some checkout took the tail, and nobody can tell which.
    mkdirSync(join(shared(), 'locks'), { recursive: true });
    writeFileSync(join(shared(), 'locks', `${tail}.head`), `0 ${'0'.repeat(64)}\n`);

    const wrote = mnema(repo, 'memory', 'after the disagreement');
    expect(wrote.status, wrote.out).toBe(0);
    expect(tails()).toHaveLength(2);
    expect(tails()).toContain(tail);
    for (const note of ['head', 'head.sig']) {
      expect(existsSync(join(shared(), 'locks', `${tail}.${note}`))).toBe(false);
      expect(existsSync(join(repo, '.mnema', 'locks', `${tail}.${note}`))).toBe(false);
    }
    const verified = mnema(repo, 'verify');
    expect(verified.status, verified.out).toBe(0);
  }, 120_000);

  it('is left alone once it was moved: what an earlier mnema writes there again is that mnema’s own', () => {
    expect(mnema(repo, 'memory', 'the first note').status).toBe(0);
    const { tail, fingerprint } = theTail();
    // The earlier mnema, still running here, mints an id of its own and notes it in the record.
    const strangerTail = `${fingerprint}-${'a'.repeat(32)}`;
    mkdirSync(join(repo, '.mnema', 'keys'), { recursive: true });
    writeFileSync(join(repo, '.mnema', 'keys', `${fingerprint}.inst`), `${'a'.repeat(32)}\n`);
    mkdirSync(join(repo, '.mnema', 'locks'), { recursive: true });
    writeFileSync(join(repo, '.mnema', 'locks', `${strangerTail}.head`), `0 ${'b'.repeat(64)}\n`);

    const wrote = mnema(repo, 'memory', 'after the earlier mnema wrote');
    expect(wrote.status, wrote.out).toBe(0);
    expect(tails()).toEqual([tail]);
    expect(readFileSync(join(repo, '.mnema', 'keys', `${fingerprint}.inst`), 'utf-8')).toBe(
      `${'a'.repeat(32)}\n`,
    );
    expect(existsSync(join(repo, '.mnema', 'locks', `${strangerTail}.head`))).toBe(true);
    expect(existsSync(join(shared(), 'locks', `${strangerTail}.head`))).toBe(false);
  }, 120_000);

  it('is refused by name where a note of it is a symbolic link, and the link is left as it is', () => {
    expect(mnema(repo, 'memory', 'the first note').status).toBe(0);
    const { tail } = leaveItAsAnEarlierMnemaDid();
    const target = join(sandbox, 'elsewhere.head');
    writeFileSync(target, 'untouched\n');
    rmSync(join(repo, '.mnema', 'locks', `${tail}.head`));
    symlinkSync(target, join(repo, '.mnema', 'locks', `${tail}.head`));

    const wrote = mnema(repo, 'memory', 'over a linked note');
    expect(wrote.status).not.toBe(0);
    expect(wrote.out).toContain('is a symbolic link');
    expect(readFileSync(target, 'utf-8')).toBe('untouched\n');
    expect(
      readdirSync(join(shared(), 'locks')).filter((name) => name.startsWith(`${tail}.head`)),
    ).toEqual([]);
  }, 120_000);
});

describe('what a killed writer leaves in the shared place', () => {
  it('is removed by the next write of the tail, and only what is a dead writer’s', () => {
    expect(mnema(repo, 'memory', 'the first note').status).toBe(0);
    const { tail } = theTail();
    const gone = spawnSync(process.execPath, ['-e', '']).pid as number;
    const orphan = join(shared(), 'locks', `${tail}.head.sig.${gone}`);
    const alive = join(shared(), 'locks', `${tail}.cited.${process.pid}`);
    const another = join(shared(), 'locks', `${'c'.repeat(64)}-${'d'.repeat(32)}.head.${gone}`);
    for (const path of [orphan, alive, another]) writeFileSync(path, 'half a note');

    expect(mnema(repo, 'memory', 'the next note').status).toBe(0);
    expect(existsSync(orphan)).toBe(false);
    expect(existsSync(alive)).toBe(true);
    expect(existsSync(another)).toBe(true);
  }, 120_000);
});

describe('a write that cannot be sure of the note naming its line', () => {
  it('is refused with nothing written, and the tail is as it was', () => {
    expect(mnema(repo, 'memory', 'the first note').status).toBe(0);
    const { tail } = theTail();
    const segment = join(repo, '.mnema', 'tails', tail, '000001.jsonl');
    const before = readFileSync(segment);
    // A directory where the signed note goes: the rename over it fails, as a disk that refuses does.
    const note = join(shared(), 'locks', `${tail}.head.sig`);
    rmSync(note);
    mkdirSync(note);

    const wrote = mnema(repo, 'memory', 'the note cannot be kept');
    expect(wrote.status).not.toBe(0);
    expect(wrote.out).toContain('INTENT_NOT_KEPT');
    expect(wrote.out).toContain('nothing was written');
    expect(readFileSync(segment).equals(before)).toBe(true);
  }, 120_000);
});

describe('a place the notes cannot be kept in', () => {
  it('refuses the write by name, and writes nothing into the checkout', () => {
    if (process.getuid?.() === 0) return;
    expect(mnema(repo, 'memory', 'the first note').status).toBe(0);
    const { tail } = theTail();
    const segment = join(repo, '.mnema', 'tails', tail, '000001.jsonl');
    const before = readFileSync(segment);
    chmodSync(shared(), 0o555);
    try {
      const wrote = mnema(repo, 'memory', 'nowhere to note it');
      expect(wrote.status).not.toBe(0);
      expect(wrote.out).toContain('MACHINERY_UNAVAILABLE');
      expect(wrote.out).toContain(shared());
      expect(readFileSync(segment).equals(before)).toBe(true);
      expect(existsSync(join(repo, '.mnema', 'locks', `${tail}.lock`))).toBe(false);
    } finally {
      chmodSync(shared(), 0o755);
    }
  }, 120_000);

  it('refuses a git directory inside the working tree, where git would stage what is noted there', () => {
    const inside = join(sandbox, 'inside');
    mkdirSync(inside);
    expect(mnema(inside, 'init').status).toBe(0);
    expect(
      git(inside, 'init', '-q', '-b', 'main', '--separate-git-dir', join(inside, 'gd')).status,
    ).toBe(0);

    const before = tails(inside);
    const wrote = mnema(inside, 'memory', 'a note');
    expect(wrote.status).not.toBe(0);
    expect(wrote.out).toContain('MACHINERY_UNAVAILABLE');
    expect(wrote.out).toContain('inside the working tree');
    expect(tails(inside)).toEqual(before);
  }, 120_000);
});

describe('a project reached through a link', () => {
  it('notes its tail where the file system says the project is, so one place and one lock', () => {
    const nested = join(repo, 'sub');
    mkdirSync(nested);
    expect(mnema(nested, 'init').status).toBe(0);
    const link = join(sandbox, 'link-to-sub');
    symlinkSync(nested, link, 'dir');

    expect(mnema(link, 'memory', 'through the link').status).toBe(0);
    expect(mnema(nested, 'memory', 'from the folder itself').status).toBe(0);
    expect(tails(nested)).toHaveLength(1);
    const place = join(repo, '.git', 'mnema', 'sub', 'public');
    expect(readdirSync(join(place, 'locks'))).toContain(`${theTail(nested).tail}.head`);
    const own = theTail(nested).tail;
    const beside = existsSync(join(nested, '.mnema', 'locks'))
      ? readdirSync(join(nested, '.mnema', 'locks'))
      : [];
    expect(beside.filter((name) => name.startsWith(`${own}.`))).toEqual([]);
  }, 120_000);
});
