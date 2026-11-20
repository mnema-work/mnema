/**
 * THE RECORD IS PUBLISHED ONLY WHERE IT IS NAMED: `mnema record publish`, with real git, a bare
 * remote that stands in for GitHub (the clone's remote address is GitHub's, and git's own
 * `insteadOf` sends the push to the bare repository) and a fake `gh` on the PATH. Nothing here
 * reaches a network.
 *
 * What it asks: the verb is off until this machine's own trees switch it on (a switch in the tree a
 * clone gets does not); the destination is named, and a HEAD that is detached or follows nothing
 * changes nothing; a repository with no e-mail of its own, or with the global one, is refused before
 * any branch exists, and a cut whose author is another is never pushed; a pull request that changes
 * only the record blocks a second one whatever its branch is called, and one open for a day is said
 * to have stalled; the push is of the record branch alone and the destination branch is as it was;
 * `gh` absent, a remote that is not GitHub's, a refused push and a pull request that did not open
 * each say what is left and what to run.
 */

import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { catalogUpcasters } from '@mnema/chain';
import { chainRootForScope, resolveTrees } from '@mnema/core';
import { openTreeForWriting, switchChannel } from '@mnema/core/write';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  changesOnlyTheRecord,
  destinationOf,
  gitHubRepositoryOf,
  recordPublishIsOn,
  runRecordPublish,
  STALLED_AFTER_HOURS,
} from '../src/commands/record-publish.js';
import { GIT_WITHOUT_MAINTENANCE } from './support/git-without-maintenance.js';
import { MNEMA_CLI } from './support/the-cli.js';

const CLI = MNEMA_CLI;
const PUBLIC = 'public@example.invalid';
const WORK = 'work@example.invalid';
const NOW = Date.parse('2026-11-20T12:00:00Z');

let sandbox: string;
let globalConfig: string;
let ghDir: string;

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'mnema-record-publish-'));
  mkdirSync(join(sandbox, 'home'), { recursive: true });
  globalConfig = join(sandbox, 'gitconfig-global');
  writeFileSync(
    globalConfig,
    `[include]\n\tpath = ${GIT_WITHOUT_MAINTENANCE}\n[user]\n\tname = Work\n\temail = ${WORK}\n`,
  );
  ghDir = join(sandbox, 'bin');
  mkdirSync(ghDir, { recursive: true });
  writeFileSync(
    join(ghDir, 'gh'),
    [
      '#!/bin/sh',
      'printf "%s\\n" "$*" >> "$GH_LOG"',
      'if [ "$1 $2" = "pr list" ]; then',
      '  if [ -f "$GH_LIST_FAILS" ]; then echo "HTTP 502" >&2; exit 1; fi',
      '  cat "$GH_LIST"; exit 0',
      'fi',
      'if [ "$1 $2" = "pr create" ]; then',
      '  cat > "$GH_BODY"',
      '  if [ -f "$GH_CREATE_FAILS" ]; then echo "HTTP 422" >&2; exit 1; fi',
      '  echo "https://github.com/acme/ledger/pull/7"',
      '  exit 0',
      'fi',
      'exit 2',
    ].join('\n'),
  );
  chmodSync(join(ghDir, 'gh'), 0o755);
  writeFileSync(join(sandbox, 'list.json'), '[]');
});

afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

function env(more: Record<string, string> = {}): Record<string, string> {
  return {
    PATH: `${ghDir}:${process.env.PATH ?? ''}`,
    HOME: join(sandbox, 'home'),
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: globalConfig,
    GH_LOG: join(sandbox, 'gh.log'),
    GH_LIST: join(sandbox, 'list.json'),
    GH_BODY: join(sandbox, 'gh.body'),
    GH_CREATE_FAILS: join(sandbox, 'create-fails'),
    GH_LIST_FAILS: join(sandbox, 'list-fails'),
    ...more,
  };
}

function git(cwd: string, ...args: string[]): { status: number; out: string } {
  const ran = spawnSync(
    'git',
    ['-c', 'init.defaultBranch=main', '-c', 'gc.auto=0', '-c', 'maintenance.auto=false', ...args],
    {
      cwd,
      encoding: 'utf-8',
      env: env(),
    },
  );
  return { status: ran.status ?? -1, out: `${ran.stdout}${ran.stderr}`.trim() };
}

function mnema(cwd: string, ...args: string[]): { status: number; out: string } {
  const ran = spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf-8', env: env() });
  return { status: ran.status ?? -1, out: `${ran.stdout}${ran.stderr}` };
}

function decide(checkout: string, title: string): void {
  const ran = mnema(checkout, 'decision', 'record', title, 'a rationale');
  expect(ran.status, ran.out).toBe(0);
}

/** A bare remote, a clone with a record, its own e-mail and a GitHub address for the remote. */
function world(): { local: string; remote: string } {
  const remote = join(sandbox, 'remote.git');
  const local = join(sandbox, 'local');
  expect(git(sandbox, 'init', '-q', '--bare', remote).status).toBe(0);
  expect(git(sandbox, 'clone', '-q', remote, local).status).toBe(0);
  expect(git(local, 'config', 'user.email', PUBLIC).status).toBe(0);
  expect(git(local, 'config', 'user.name', 'Public').status).toBe(0);
  expect(mnema(local, 'init', '--all-hosts').status).toBe(0);
  expect(git(local, 'add', '.').status).toBe(0);
  expect(git(local, 'commit', '-qm', 'the record').status).toBe(0);
  expect(git(local, 'push', '-q', 'origin', 'main').status).toBe(0);
  // The address says GitHub; the push goes to the bare repository.
  expect(
    git(local, 'config', 'remote.origin.url', 'https://github.com/acme/ledger.git').status,
  ).toBe(0);
  expect(
    git(local, 'config', `url.${remote}.insteadOf`, 'https://github.com/acme/ledger.git').status,
  ).toBe(0);
  expect(git(local, 'update-ref', 'refs/remotes/origin/main', 'HEAD').status).toBe(0);
  return { local, remote };
}

function switchOn(local: string): void {
  const ran = mnema(local, 'switch', 'on', 'record-publish');
  expect(ran.status, ran.out).toBe(0);
}

function publish(
  checkout: string,
  input: { to: string | undefined; through?: string } = { to: 'origin/main' },
  processEnv: Record<string, string> = env(),
) {
  return runRecordPublish(
    { cwd: checkout, env: { home: join(sandbox, 'home') }, processEnv, now: NOW },
    input,
  );
}

function listed(...prs: { number: number; hoursAgo: number; files: string[]; head?: string }[]) {
  writeFileSync(
    join(sandbox, 'list.json'),
    JSON.stringify(
      prs.map((pr) => ({
        number: pr.number,
        url: `https://github.com/acme/ledger/pull/${pr.number}`,
        createdAt: new Date(NOW - pr.hoursAgo * 3_600_000).toISOString(),
        headRefName: pr.head ?? 'a-branch',
        files: pr.files.map((path) => ({ path, additions: 1, deletions: 0 })),
      })),
    ),
  );
}

const ghCalls = (): string[] => {
  try {
    return readFileSync(join(sandbox, 'gh.log'), 'utf-8').split('\n').filter(Boolean);
  } catch {
    return [];
  }
};

const recordBranches = (local: string): string =>
  git(local, 'branch', '--list', 'mnema-record/*').out;

const SLOW = { timeout: 120_000 };

describe('the words it reads', () => {
  it('splits a destination at the longest remote name, and refuses what is not one', () => {
    expect(destinationOf('origin/main', ['origin'])).toEqual({ remote: 'origin', branch: 'main' });
    expect(destinationOf('up/stream/release/1', ['up', 'up/stream'])).toEqual({
      remote: 'up/stream',
      branch: 'release/1',
    });
    expect(destinationOf('origin/', ['origin'])).toBeUndefined();
    expect(destinationOf('origin', ['origin'])).toBeUndefined();
    expect(destinationOf('elsewhere/main', ['origin'])).toBeUndefined();
  });

  it('takes the owner and name of a GitHub address only', () => {
    expect(gitHubRepositoryOf('https://github.com/acme/ledger.git')).toBe('acme/ledger');
    expect(gitHubRepositoryOf('git@github.com:acme/ledger.git')).toBe('acme/ledger');
    expect(gitHubRepositoryOf('ssh://git@ssh.github.com:443/acme/ledger')).toBe('acme/ledger');
    expect(gitHubRepositoryOf('https://gitlab.com/acme/ledger.git')).toBeUndefined();
    expect(gitHubRepositoryOf('/tmp/remote.git')).toBeUndefined();
  });

  it('calls a pull request the record’s by what it changes, never by its name', () => {
    expect(changesOnlyTheRecord([{ path: '.mnema/tails/a/000001.jsonl' }], '.mnema/')).toBe(true);
    expect(
      changesOnlyTheRecord(
        [{ path: '.mnema/tails/a/000001.jsonl' }, { path: 'src/a.ts' }],
        '.mnema/',
      ),
    ).toBe(false);
    expect(changesOnlyTheRecord([], '.mnema/')).toBe(false);
  });
});

describe('mnema record publish', SLOW, () => {
  it('is off until this machine switches it on, and a switch in the tree a clone gets does not', () => {
    const { local } = world();
    decide(local, 'a decision');
    expect(publish(local)).toEqual({ ok: false, reason: 'SWITCH_OFF' });

    // The tree a clone gets cannot be asked to turn it on through the verb ...
    const refused = mnema(local, 'switch', 'on', 'record-publish', '--scope', 'public');
    expect(refused.status).not.toBe(0);
    expect(refused.out).toContain('MACHINE_ONLY');

    // ... and where one is there all the same (a fact written by hand), it is not read.
    const trees = resolveTrees(local, { home: join(sandbox, 'home') });
    const writer = openTreeForWriting(trees, 'public');
    writer.exclusively(() => {
      const written = switchChannel(
        {
          writer,
          layout: { root: chainRootForScope(trees, 'public') as string },
          upcasters: catalogUpcasters(),
        },
        { channel: 'record-publish', on: true },
      );
      expect(written.ok).toBe(true);
      writer.checkpoint();
    });
    const ctx = { cwd: local, env: { home: join(sandbox, 'home') }, processEnv: env(), now: NOW };
    expect(recordPublishIsOn(ctx)).toBe(false);
    expect(publish(local)).toEqual({ ok: false, reason: 'SWITCH_OFF' });
    // The listing says what the verb does: off, though the committed tree holds an on.
    expect(mnema(local, 'switch').out).toMatch(/record-publish +off /);

    switchOn(local);
    expect(recordPublishIsOn(ctx)).toBe(true);
    expect(ghCalls()).toEqual([]);

    // The tree a clone gets can still switch it off, as it can any channel: off wins.
    const off = openTreeForWriting(trees, 'public');
    off.exclusively(() => {
      const written = switchChannel(
        {
          writer: off,
          layout: { root: chainRootForScope(trees, 'public') as string },
          upcasters: catalogUpcasters(),
        },
        { channel: 'record-publish', on: false },
      );
      expect(written.ok).toBe(true);
      off.checkpoint();
    });
    expect(recordPublishIsOn(ctx)).toBe(false);
  });

  it('pushes the record branch alone and opens one pull request into the named branch', () => {
    const { local, remote } = world();
    switchOn(local);
    decide(local, 'the first decision');
    const mainBefore = git(remote, 'rev-parse', 'refs/heads/main').out;
    const headBefore = git(local, 'rev-parse', 'HEAD').out;

    const done = publish(local);
    if (!done.ok || done.kind !== 'published') throw new Error(JSON.stringify(done));
    expect(done.url).toBe('https://github.com/acme/ledger/pull/7');
    expect(done.branch).toMatch(/^mnema-record\/adr-1-[0-9a-f]{12}$/);
    expect(done.title).toBe('Record ADR-1');

    // The remote holds that branch at the cut's commit, and `main` is where it was.
    expect(git(remote, 'rev-parse', `refs/heads/${done.branch}`).out).toBe(done.commit);
    expect(git(remote, 'rev-parse', 'refs/heads/main').out).toBe(mainBefore);
    expect(git(remote, 'for-each-ref', '--format=%(refname)').out.split('\n').sort()).toEqual(
      ['refs/heads/main', `refs/heads/${done.branch}`].sort(),
    );
    expect(git(local, 'rev-parse', 'HEAD').out).toBe(headBefore);
    // The commit is by this repository's own e-mail and by nobody else's.
    expect(git(local, 'log', '-1', '--format=%ae %ce', done.commit).out).toBe(
      `${PUBLIC} ${PUBLIC}`,
    );
    expect(git(local, 'log', '-1', '--format=%B', done.commit).out).not.toContain(WORK);

    // gh listed the open pull requests of that repository, then opened one with the cut's body.
    const calls = ghCalls();
    expect(calls).toHaveLength(2);
    expect(calls[0]).toContain('pr list --repo acme/ledger --state open --base main');
    expect(calls[1]).toBe(
      `pr create --repo acme/ledger --base main --head ${done.branch} --title Record ADR-1 --body-file -`,
    );
    expect(readFileSync(join(sandbox, 'gh.body'), 'utf-8')).toContain('ADR-1');
  });

  it('names its destination and deduces none: a detached HEAD, or a branch that follows nothing', () => {
    const { local, remote } = world();
    switchOn(local);
    decide(local, 'a decision');
    expect(git(local, 'checkout', '-q', '--detach').status).toBe(0);

    expect(publish(local, { to: undefined })).toMatchObject({
      ok: false,
      reason: 'NO_DESTINATION',
    });
    expect(publish(local, { to: 'origin' })).toMatchObject({ ok: false, reason: 'NO_DESTINATION' });
    expect(publish(local, { to: 'nowhere/main' })).toMatchObject({
      ok: false,
      reason: 'NO_DESTINATION',
    });
    // A branch of the remote this clone does not hold: refused, no branch made, nothing pushed.
    expect(publish(local, { to: 'origin/release' })).toMatchObject({
      ok: false,
      reason: 'CUT_REFUSED',
      refused: { reason: 'NO_SUCH_DESTINATION', remote: 'origin', branch: 'release' },
    });
    expect(recordBranches(local)).toBe('');
    expect(ghCalls().filter((line) => line.startsWith('pr create'))).toEqual([]);

    // With HEAD detached, and with no remote that anything follows, the named one still works.
    const done = publish(local);
    expect(done).toMatchObject({ ok: true, kind: 'published' });
    expect(git(remote, 'branch', '--list', 'mnema-record/*').out).not.toBe('');
  });

  it('refuses a repository with no e-mail of its own, or the global one, before any branch exists', () => {
    const { local } = world();
    switchOn(local);
    decide(local, 'a decision');

    expect(git(local, 'config', '--unset', 'user.email').status).toBe(0);
    expect(publish(local)).toEqual({ ok: false, reason: 'NO_PUBLIC_IDENTITY', why: 'unset' });

    expect(git(local, 'config', 'user.email', WORK.toUpperCase()).status).toBe(0);
    expect(publish(local)).toEqual({
      ok: false,
      reason: 'NO_PUBLIC_IDENTITY',
      why: 'same-as-global',
    });
    expect(recordBranches(local)).toBe('');
    expect(ghCalls()).toEqual([]);
  });

  it('pushes nothing when the cut carries an author that is not the repository’s own', () => {
    const { local, remote } = world();
    switchOn(local);
    decide(local, 'a decision');

    const done = publish(local, { to: 'origin/main' }, env({ GIT_AUTHOR_EMAIL: WORK }));
    expect(done).toMatchObject({ ok: false, reason: 'AUTHOR_NOT_PUBLIC' });
    expect(git(remote, 'branch', '--list', 'mnema-record/*').out).toBe('');
    expect(ghCalls().filter((line) => line.startsWith('pr create'))).toEqual([]);
  });

  it('is blocked by an open pull request that changes only the record, whatever its branch is called', () => {
    const { local, remote } = world();
    switchOn(local);
    decide(local, 'a decision');

    listed({ number: 5, hoursAgo: 2, files: ['.mnema/tails/x/000001.jsonl'], head: 'feature/odd' });
    const blocked = publish(local);
    expect(blocked).toEqual({
      ok: false,
      reason: 'PULL_REQUEST_OPEN',
      pullRequest: {
        number: 5,
        url: 'https://github.com/acme/ledger/pull/5',
        hoursOpen: 2,
        stalled: false,
      },
    });
    expect(recordBranches(local)).toBe('');
    expect(git(remote, 'branch', '--list', 'mnema-record/*').out).toBe('');

    // Open for a day: the same refusal, and it says that it stalled.
    listed({ number: 5, hoursAgo: 30, files: ['.mnema/tails/x/000001.jsonl'] });
    expect(publish(local)).toMatchObject({
      ok: false,
      reason: 'PULL_REQUEST_OPEN',
      pullRequest: { hoursOpen: 30, stalled: true },
    });
    expect(STALLED_AFTER_HOURS).toBe(24);
    listed({ number: 5, hoursAgo: STALLED_AFTER_HOURS, files: ['.mnema/a'] });
    expect(publish(local)).toMatchObject({ pullRequest: { stalled: true } });

    // A branch named like a record branch that changes code is not a record pull request.
    listed(
      {
        number: 6,
        hoursAgo: 1,
        files: ['.mnema/tails/x/000001.jsonl', 'src/a.ts'],
        head: 'mnema-record/x',
      },
      { number: 7, hoursAgo: 1, files: [], head: 'mnema-record/y' },
    );
    expect(publish(local)).toMatchObject({ ok: true, kind: 'published' });
  });

  it('reads the global e-mail through the files its configuration includes', () => {
    const { local } = world();
    switchOn(local);
    decide(local, 'a decision');
    const work = join(sandbox, 'work.gitconfig');
    writeFileSync(work, `[user]\n\temail = ${WORK}\n`);
    writeFileSync(
      globalConfig,
      `[include]\n\tpath = ${GIT_WITHOUT_MAINTENANCE}\n\tpath = ${work}\n`,
    );
    expect(git(local, 'config', 'user.email', WORK).status).toBe(0);
    expect(publish(local)).toEqual({
      ok: false,
      reason: 'NO_PUBLIC_IDENTITY',
      why: 'same-as-global',
    });
    expect(recordBranches(local)).toBe('');
  });

  it('refuses, and cuts nothing, where gh cannot say what is open', () => {
    const { local } = world();
    switchOn(local);
    decide(local, 'a decision');
    const refused = () => expect(publish(local)).toMatchObject({ ok: false, reason: 'GH_FAILED' });

    writeFileSync(join(sandbox, 'list-fails'), '');
    refused();
    rmSync(join(sandbox, 'list-fails'));
    writeFileSync(join(sandbox, 'list.json'), 'not json');
    refused();
    writeFileSync(join(sandbox, 'list.json'), '{"number": 1}');
    refused();
    writeFileSync(join(sandbox, 'list.json'), '[{"number": 1}]');
    refused();
    // A full page of pull requests may hide a record one past it.
    listed(
      ...Array.from({ length: 100 }, (_, at) => ({
        number: at + 1,
        hoursAgo: 1,
        files: ['src/a.ts'],
      })),
    );
    refused();
    expect(recordBranches(local)).toBe('');
    expect(ghCalls().filter((line) => line.startsWith('pr create'))).toEqual([]);
  });

  it('asks the forge about the repository the push reaches, and refuses a push address that names another', () => {
    const { local } = world();
    switchOn(local);
    decide(local, 'a decision');
    expect(
      git(local, 'config', 'remote.origin.pushurl', 'https://github.com/someone/fork.git').status,
    ).toBe(0);
    expect(publish(local)).toEqual({ ok: false, reason: 'NOT_GITHUB', remote: 'origin' });
    expect(recordBranches(local)).toBe('');
    expect(ghCalls()).toEqual([]);
  });

  it('says what to do by hand where gh is absent or the remote is not GitHub’s', () => {
    const { local } = world();
    switchOn(local);
    decide(local, 'a decision');

    // A PATH with git and nothing else.
    const onlyGit = join(sandbox, 'only-git');
    mkdirSync(onlyGit);
    const gitPath = spawnSync('which', ['git'], { encoding: 'utf-8' }).stdout.trim();
    symlinkSync(gitPath, join(onlyGit, 'git'));
    expect(publish(local, { to: 'origin/main' }, env({ PATH: onlyGit }))).toEqual({
      ok: false,
      reason: 'GH_ABSENT',
    });

    expect(
      git(local, 'config', 'remote.origin.url', 'https://git.example.invalid/acme/ledger.git')
        .status,
    ).toBe(0);
    expect(publish(local)).toEqual({ ok: false, reason: 'NOT_GITHUB', remote: 'origin' });
    expect(recordBranches(local)).toBe('');
  });

  it('leaves a branch that was not pushed or a pull request that did not open to be run again', () => {
    const { local, remote } = world();
    switchOn(local);
    decide(local, 'a decision');

    // The push is refused: the branch stays here, and the next run pushes it.
    writeFileSync(join(remote, 'hooks', 'pre-receive'), '#!/bin/sh\nexit 1\n');
    chmodSync(join(remote, 'hooks', 'pre-receive'), 0o755);
    const failed = publish(local);
    expect(failed).toMatchObject({ ok: false, reason: 'PUSH_FAILED' });
    expect(recordBranches(local)).not.toBe('');
    expect(ghCalls().filter((line) => line.startsWith('pr create'))).toEqual([]);
    rmSync(join(remote, 'hooks', 'pre-receive'));

    // The push lands and gh refuses: the branch is on the remote, and the next run opens it.
    writeFileSync(join(sandbox, 'create-fails'), '');
    const notOpened = publish(local);
    expect(notOpened).toMatchObject({ ok: false, reason: 'PULL_REQUEST_NOT_OPENED' });
    const branch = (notOpened as { branch: string }).branch;
    expect(git(remote, 'rev-parse', '--verify', `refs/heads/${branch}`).status).toBe(0);
    rmSync(join(sandbox, 'create-fails'));
    expect(publish(local)).toMatchObject({ ok: true, kind: 'published', branch });
  });

  it('never forces the push: a branch of that name that the remote holds elsewhere stays as it is', () => {
    const { local, remote } = world();
    switchOn(local);
    decide(local, 'a decision');
    const first = publish(local);
    if (!first.ok || first.kind !== 'published') throw new Error(JSON.stringify(first));

    // Someone put an unrelated commit under the same name on the remote.
    const empty = git(local, 'hash-object', '-t', 'tree', '/dev/null').out;
    const stray = git(local, 'commit-tree', empty, '-m', 'a stray').out;
    expect(git(local, 'push', '-f', 'origin', `${stray}:refs/heads/${first.branch}`).status).toBe(
      0,
    );

    const again = publish(local);
    expect(again).toMatchObject({ ok: false, reason: 'PUSH_FAILED', branch: first.branch });
    expect(git(remote, 'rev-parse', `refs/heads/${first.branch}`).out).toBe(stray);
  });

  it('says there is nothing to publish where the base holds the record, and opens nothing', () => {
    const { local } = world();
    switchOn(local);
    const done = publish(local);
    expect(done).toMatchObject({ ok: true, kind: 'nothing' });
    expect(ghCalls().filter((line) => line.startsWith('pr create'))).toEqual([]);
  });

  it('is a verb of the binary: refused and worded while off, on for this machine once switched on', () => {
    const { local } = world();
    decide(local, 'a decision');
    const off = mnema(local, 'record', 'publish', '--to', 'origin/main');
    expect(off.status).not.toBe(0);
    expect(off.out).toContain('`mnema switch on record-publish`');

    const on = mnema(local, 'switch', 'on', 'record-publish');
    expect(on.status, on.out).toBe(0);
    const bare = mnema(local, 'record', 'publish');
    expect(bare.status).not.toBe(0);
    expect(bare.out).toContain('--to <remote>/<branch>');

    const done = mnema(local, 'record', 'publish', '--to', 'origin/main', '--json');
    expect(done.status, done.out).toBe(0);
    expect(JSON.parse(done.out)).toMatchObject({
      ok: true,
      kind: 'published',
      url: 'https://github.com/acme/ledger/pull/7',
    });
  });
});
