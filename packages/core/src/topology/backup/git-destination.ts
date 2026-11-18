/**
 * A git repository as the place a backup is kept (ADR-372).
 *
 * A destination is a git one where it is written as a remote (`https://`, `ssh://`, `file://`,
 * `user@host:path`) or is the folder of a bare repository. `run` keeps a CLONE CACHE of it in the
 * data directory, writes the copy there as it would write a folder, commits it and pushes; `verify`
 * and `restore` bring the cache up to the remote first and read it as a folder.
 *
 * THE DESTINATION KEEPS THE WHOLE HISTORY. Every run adds a commit to the one the remote has: a
 * remote that holds what the cache does not is brought in by a fast-forward and by nothing else,
 * and one that has gone another way is refused, whole, with nothing rewritten. No call here amends,
 * squashes, rebases, resets or forces a push.
 *
 * EVERY GIT RUNS WITH A CLEAN ENVIRONMENT. The environment a hook hands to a program (GIT_DIR,
 * GIT_INDEX_FILE, GIT_WORK_TREE) points at the repository the person was committing in; it must
 * never reach the git that works on the destination, so no variable of the name `GIT_*` is
 * inherited, and `GIT_TERMINAL_PROMPT=0` keeps a missing credential from waiting for a person.
 *
 * A CREDENTIAL IS NEVER KEPT. A remote written with a password, or an `http(s)` one written with
 * any user at all (a token is a user there), is refused: the file that names the destination is
 * not the place for a secret. A remote is printed without its userinfo.
 */

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { CodedError } from '@mnema/chain';

/** A git destination could not be used, and nothing was rewritten. */
export class GitDestinationError extends CodedError {
  override readonly name = 'GitDestinationError';
  readonly code: 'GIT_FAILED' | 'GIT_DIVERGED' | 'GIT_CACHE_FOREIGN' | 'GIT_REMOTE_REFUSED';

  constructor(code: GitDestinationError['code'], message: string) {
    super(message);
    this.code = code;
  }
}

const SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;
const SCP_LIKE = /^[^\s/\\:@]+@[^\s/\\:]+:/;

/** Whether `folder` is a bare git repository: the three things git itself looks for. */
function isBareRepository(folder: string): boolean {
  try {
    return (
      statSync(folder).isDirectory() &&
      existsSync(join(folder, 'HEAD')) &&
      existsSync(join(folder, 'objects')) &&
      existsSync(join(folder, 'refs'))
    );
  } catch {
    return false;
  }
}

/** Whether what `setup` was given names a git repository, and not a folder: a remote, or a bare repository's folder. */
export function isGitDestination(destination: string): boolean {
  return SCHEME.test(destination) || SCP_LIKE.test(destination) || isBareRepository(destination);
}

/** The remote without its userinfo: what is printed, and never the user or a password. */
export function withoutUserinfo(remote: string): string {
  if (SCHEME.test(remote)) return remote.replace(/^([a-z][a-z0-9+.-]*:\/\/)[^/@]*@/i, '$1');
  return remote.replace(/^[^\s/\\:@]+@/, '');
}

/** Why a remote cannot be kept in the configuration, or undefined. */
export function whyNotARemote(remote: string): string | undefined {
  if (remote.startsWith('-')) {
    return 'A destination that starts with a dash is read by git as an option, and is not taken.';
  }
  const scheme = /^([a-z][a-z0-9+.-]*):\/\/([^/@]*)@/i.exec(remote);
  if (scheme !== undefined && scheme !== null) {
    const userinfo = scheme[2] as string;
    const web = /^https?$/i.test(scheme[1] as string);
    if (userinfo.includes(':') || web) {
      return `${withoutUserinfo(remote)} was written with ${userinfo.includes(':') ? 'a password' : 'a user'} in it, and a credential is never kept in the backup's configuration. Name the remote without it and let a credential helper or an ssh key answer.`;
    }
  }
  return undefined;
}

/** The folder of the clone cache of `destination`, in the data directory `dataDir`. */
export function cacheOf(dataDir: string, destination: string): string {
  const name = createHash('sha256').update(destination).digest('hex').slice(0, 24);
  return join(dataDir, 'backup-git', name);
}

/**
 * The environment every git of the destination runs with: the one the process has, less every
 * variable named `GIT_*`, and no prompt. `from` is the process's own; a test hands another.
 */
export function cleanGitEnv(from: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const clean: NodeJS.ProcessEnv = {};
  for (const [name, value] of Object.entries(from)) {
    if (value !== undefined && !/^GIT_/i.test(name)) clean[name] = value;
  }
  clean.GIT_TERMINAL_PROMPT = '0';
  return clean;
}

interface Ran {
  readonly status: number;
  readonly out: string;
}

/** One git, the commit's identity and everything that could run a program or change a byte fixed on its command line. */
function run(
  remote: string,
  cwd: string,
  args: readonly string[],
  env: NodeJS.ProcessEnv,
  tolerate = false,
): Ran {
  const ran = spawnSync(
    'git',
    [
      '-c',
      'gc.auto=0',
      '-c',
      'maintenance.auto=false',
      '-c',
      `core.hooksPath=${join(cwd, '.git', 'no-hooks')}`,
      '-c',
      'core.autocrlf=false',
      '-c',
      'commit.gpgsign=false',
      '-c',
      'user.name=mnema backup',
      '-c',
      'user.email=backup@mnema.invalid',
      ...args,
    ],
    {
      cwd,
      env,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 300_000,
      maxBuffer: 1 << 28,
    },
  );
  const status = ran.status ?? -1;
  if (status !== 0 && !tolerate) {
    const shown = withoutUserinfo(remote);
    const said = `${ran.stderr ?? ''}${ran.error === undefined ? '' : String(ran.error)}`
      .split(remote)
      .join(shown)
      .trim();
    throw new GitDestinationError(
      'GIT_FAILED',
      `git ${args[0]} on the backup at ${shown} failed${said === '' ? '' : `: ${said}`}. Nothing of the destination was rewritten.`,
    );
  }
  return { status, out: (ran.stdout ?? '').trim() };
}

/** The branch the cache is on. */
function branchOf(remote: string, cache: string, env: NodeJS.ProcessEnv): string {
  return run(remote, cache, ['symbolic-ref', '--short', 'HEAD'], env).out;
}

/**
 * Brings the cache of `remote` to what the remote holds: clones it where there is no cache, and
 * otherwise fetches and fast-forwards. A cache that holds commits the remote lacks is left as it
 * is (the next push sends them); one that has gone another way is refused.
 */
export function syncCache(
  remote: string,
  cache: string,
  env: NodeJS.ProcessEnv = cleanGitEnv(),
): void {
  if (!existsSync(join(cache, '.git'))) {
    if (existsSync(cache) && readdirSync(cache).length > 0) {
      throw new GitDestinationError(
        'GIT_CACHE_FOREIGN',
        `${cache} exists, holds files and is no clone: the backup at ${withoutUserinfo(remote)} is not cloned over them. Nothing was changed.`,
      );
    }
    mkdirSync(dirname(cache), { recursive: true });
    run(
      remote,
      dirname(cache),
      ['clone', '-q', '--config', 'core.autocrlf=false', '--', remote, cache],
      env,
    );
    return;
  }
  const known = run(remote, cache, ['config', '--get', 'remote.origin.url'], env, true).out;
  if (known !== remote) {
    throw new GitDestinationError(
      'GIT_CACHE_FOREIGN',
      `${cache} is the clone of another remote than ${withoutUserinfo(remote)}, and is not used for it. Nothing was changed.`,
    );
  }
  run(remote, cache, ['fetch', '-q', 'origin'], env);
  const branch = branchOf(remote, cache, env);
  const theirs = `refs/remotes/origin/${branch}`;
  if (run(remote, cache, ['rev-parse', '--verify', '-q', theirs], env, true).status !== 0) return;
  const head = run(remote, cache, ['rev-parse', '--verify', '-q', 'HEAD'], env, true);
  if (head.status !== 0) return;
  const behindOrEqual = run(
    remote,
    cache,
    ['merge-base', '--is-ancestor', 'HEAD', theirs],
    env,
    true,
  );
  if (behindOrEqual.status === 0) {
    run(remote, cache, ['merge', '-q', '--ff-only', theirs], env);
    return;
  }
  if (run(remote, cache, ['merge-base', '--is-ancestor', theirs, 'HEAD'], env, true).status !== 0) {
    throw new GitDestinationError(
      'GIT_DIVERGED',
      `The backup at ${withoutUserinfo(remote)} holds history this machine's cache does not have, and the cache holds history the remote does not: they have gone different ways, and neither is overwritten (no merge, no reset, no forced push). Nothing was changed.`,
    );
  }
}

/** What committing and pushing the cache did. */
export interface Pushed {
  /** Whether this call made a commit: false where the copy changed no file. */
  readonly committed: boolean;
  /** How many commits the push sent. */
  readonly pushed: number;
}

/**
 * Commits what the copy changed in the cache and pushes the branch, with no force. The commit is
 * new, on top of the history: nothing is amended, and what an earlier run committed and could not
 * push goes with this push.
 */
export function commitAndPush(
  remote: string,
  cache: string,
  now: Date,
  env: NodeJS.ProcessEnv = cleanGitEnv(),
): Pushed {
  run(remote, cache, ['add', '-A', '--', '.'], env);
  const changed = run(remote, cache, ['status', '--porcelain'], env).out !== '';
  if (changed) {
    run(remote, cache, ['commit', '-q', '--no-verify', '-m', `Back up ${now.toISOString()}`], env);
  }
  const branch = branchOf(remote, cache, env);
  const theirs = `refs/remotes/origin/${branch}`;
  const known = run(remote, cache, ['rev-parse', '--verify', '-q', theirs], env, true).status === 0;
  const counted = run(
    remote,
    cache,
    ['rev-list', '--count', known ? `${theirs}..HEAD` : 'HEAD'],
    env,
  ).out;
  const ahead = Number(counted);
  if (ahead > 0) run(remote, cache, ['push', '-q', 'origin', `HEAD:refs/heads/${branch}`], env);
  return { committed: changed, pushed: ahead };
}

/** Where a local folder given as a destination is, as the configuration keeps it. */
export function keptAs(cwd: string, destination: string): string {
  return SCHEME.test(destination) || SCP_LIKE.test(destination)
    ? destination
    : resolve(cwd, destination);
}
