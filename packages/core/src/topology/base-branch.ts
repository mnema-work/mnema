/**
 * Whether an entry of a tail is already on the repository's base branch, for the write that decides
 * which tail to go on with (`pool.ts` in the chain, ADR-446): a tail whose end only some branch holds
 * is not continued from another worktree, so that two branches never write one tail file past the
 * point they share, which a squash merge on a host with no merge driver cannot settle.
 *
 * THE BASE BRANCH is the remote's default branch as this clone last read it (`theDefaultBranch`), with
 * no network and nothing written. A repository with no remote, or with no default branch known to it,
 * has no base branch, and the answer is then always no: nothing is continued from another worktree
 * there, and a worktree goes on only with the tails it wrote itself.
 */

import { spawnSync } from 'node:child_process';
import { readFileSync, realpathSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { theDefaultBranch } from './default-branch.js';

/** Names that point git at another repository than the one a directory names. */
const REPOSITORY_VARIABLES = [
  'GIT_DIR',
  'GIT_WORK_TREE',
  'GIT_INDEX_FILE',
  'GIT_COMMON_DIR',
  'GIT_OBJECT_DIRECTORY',
  'GIT_ALTERNATE_OBJECT_DIRECTORIES',
] as const;

const GIT_BUDGET_MS = 5_000;

/**
 * What all the questions of one write may take together: a git that hangs costs the write this much
 * at most, and the answer to every question after it is no (the write opens a tail, the side that
 * cannot fork or conflict).
 */
export const BASE_BUDGET_MS = 10_000;

/**
 * Answers, for a tail of the record under `record` (in the working tree `top`), whether the entry
 * with `hash` is in the segment `segment` of that tail as the base branch holds it. The default
 * branch is looked up at the first question and kept for the rest of the write.
 */
export function entryIsOnTheBase(
  top: string,
  record: string,
  budgetMs: number = BASE_BUDGET_MS,
): (tailId: string, segment: string, hash: string) => boolean | undefined {
  let cwd: string;
  let prefix: string;
  try {
    cwd = realpathSync.native(top);
    prefix = relative(cwd, realpathSync.native(record)).split(sep).join('/');
  } catch {
    return () => false;
  }
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    GIT_OPTIONAL_LOCKS: '0',
    GIT_NO_LAZY_FETCH: '1',
    GIT_TERMINAL_PROMPT: '0',
  };
  for (const name of REPOSITORY_VARIABLES) Reflect.deleteProperty(env, name);
  let spent = 0;
  let unanswered = false;
  const run = (args: readonly string[]): { status: number | null; out: Buffer } => {
    const left = budgetMs - spent;
    if (left <= 0) {
      unanswered = true;
      return { status: null, out: Buffer.alloc(0) };
    }
    const began = Date.now();
    const ran = spawnSync('git', ['-c', 'gc.auto=0', '-c', 'maintenance.auto=false', ...args], {
      cwd,
      env,
      maxBuffer: 1 << 30,
      timeout: Math.min(GIT_BUDGET_MS, left),
    });
    spent += Date.now() - began;
    if (ran.status === null) unanswered = true;
    return { status: ran.status, out: ran.stdout ?? Buffer.alloc(0) };
  };
  let commit: string | false | undefined;
  const baseCommit = (): string | false => {
    if (commit === undefined) {
      const asked = theDefaultBranch((args) => {
        const ran = run(args);
        return ran.status === 0 ? ran.out.toString('utf-8').trim() : undefined;
      });
      commit = asked.ok ? asked.commit : false;
    }
    return commit;
  };
  return (tailId, segment, hash) => {
    const base = baseCommit();
    if (unanswered) return undefined;
    if (base === false) return false;
    const path = [prefix, 'tails', tailId, segment].filter((part) => part !== '').join('/');
    const ran = run(['cat-file', 'blob', `${base}:${path}`]);
    if (unanswered) return undefined;
    return ran.status === 0 && holdsAsItsOwnHash(ran.out.toString('utf-8'), hash);
  };
}

/** The most commits that hold a tail that {@link tailIsHeldOnlyBy} looks through before it says it cannot tell. */
const COMMITS_LOOKED_AT_MOST = 64;

/**
 * Answers, for a tail of the record under `record` (in the working tree `top`) and a branch, whether
 * no commit holds a file of the tail, or every ref (local branches, remote-tracking branches and tags)
 * that contains a commit holding one is that branch alone: false where another ref has it, undefined
 * where git did not answer in time or more commits touch it than are looked through. Asked once for the
 * one tail that has no mark and is the only one of its key (`firstTailOfTheRepository` in the chain), so
 * a tail written before the repository existed, or committed on this branch alone, is told from one
 * another branch may hold too.
 */
export function tailIsHeldOnlyBy(
  top: string,
  record: string,
): (tailId: string, branch: string) => boolean | undefined {
  let cwd: string;
  let prefix: string;
  try {
    cwd = realpathSync.native(top);
    prefix = relative(cwd, realpathSync.native(record)).split(sep).join('/');
  } catch {
    return () => undefined;
  }
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    GIT_OPTIONAL_LOCKS: '0',
    GIT_NO_LAZY_FETCH: '1',
    GIT_TERMINAL_PROMPT: '0',
  };
  for (const name of REPOSITORY_VARIABLES) Reflect.deleteProperty(env, name);
  const deadline = Date.now() + GIT_BUDGET_MS;
  const run = (args: readonly string[]): string | undefined => {
    const left = deadline - Date.now();
    if (left <= 0) return undefined;
    const ran = spawnSync('git', ['-c', 'gc.auto=0', '-c', 'maintenance.auto=false', ...args], {
      cwd,
      env,
      encoding: 'utf-8',
      maxBuffer: 1 << 26,
      timeout: left,
    });
    return ran.status === 0 ? ran.stdout : undefined;
  };
  return (tailId, branch) => {
    const path = [prefix, 'tails', tailId].filter((part) => part !== '').join('/');
    const log = run(['log', '--all', '--format=%H', '--', path]);
    if (log === undefined) return undefined;
    const commits = log.split('\n').filter((line) => line !== '');
    if (commits.length === 0) return true;
    if (commits.length > COMMITS_LOOKED_AT_MOST) return undefined;
    const refs = run([
      'for-each-ref',
      '--format=%(refname)',
      ...commits.map((commit) => `--contains=${commit}`),
      'refs/',
    ]);
    if (refs === undefined) return undefined;
    const held = refs.split('\n').filter((line) => line !== '');
    return held.length === 1 && held[0] === `refs/heads/${branch}`;
  };
}

/**
 * The branch a worktree has checked out, or undefined for a detached HEAD or where it cannot be said.
 * Read from the worktree's `HEAD` file; a repository kept in the `reftable` format writes the stub
 * `refs/heads/.invalid` there in every worktree, whatever the branch, so there git is asked
 * (`symbolic-ref`, within the same bounded time, and once for each state of the worktree's
 * `reftable/tables.list`), and where it does not answer the HEAD counts as detached, which asks the
 * base branch (the side that cannot conflict).
 */
export function branchOfWorktree(gitDir: string, top: string): string | undefined {
  let head: string;
  try {
    head = readFileSync(join(gitDir, 'HEAD'), 'utf-8').trim();
  } catch {
    return undefined;
  }
  if (!head.startsWith('ref: refs/heads/')) return undefined;
  const named = head.slice('ref: refs/heads/'.length);
  if (named !== '.invalid') return named;
  // In a reftable repository the HEAD file is a stub that never changes; any update of a ref,
  // HEAD's included, rewrites `reftable/tables.list` with the name of a new table. So the answer
  // of git is kept for the content of that list and asked again the moment it differs.
  const stack = tableStackOf(gitDir);
  const kept = BRANCH_OF_A_REFTABLE_STACK.get(gitDir);
  if (stack !== undefined && kept !== undefined && kept.stack === stack) return kept.branch;
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    GIT_OPTIONAL_LOCKS: '0',
    GIT_TERMINAL_PROMPT: '0',
  };
  for (const name of REPOSITORY_VARIABLES) Reflect.deleteProperty(env, name);
  const ran = spawnSync('git', ['symbolic-ref', '--quiet', 'HEAD'], {
    cwd: top,
    env,
    encoding: 'utf-8',
    timeout: GIT_BUDGET_MS,
  });
  const ref = ran.status === 0 ? ran.stdout.trim() : '';
  const branch = ref.startsWith('refs/heads/') ? ref.slice('refs/heads/'.length) : undefined;
  // A git that did not answer (a timeout, an error) is not kept: the next write asks again. Status 1 is a detached HEAD, an answer.
  if (stack !== undefined && (ran.status === 0 || ran.status === 1))
    BRANCH_OF_A_REFTABLE_STACK.set(gitDir, { stack, branch });
  return branch;
}

/** The branch git said for a worktree, with the content of the table list it said it for. */
const BRANCH_OF_A_REFTABLE_STACK = new Map<
  string,
  { readonly stack: string; readonly branch: string | undefined }
>();

/** The content of the worktree's `reftable/tables.list`, or undefined where it cannot be read (then git is asked every time). */
function tableStackOf(gitDir: string): string | undefined {
  try {
    return readFileSync(join(gitDir, 'reftable', 'tables.list'), 'utf-8');
  } catch {
    return undefined;
  }
}

/** Whether a line of the segment is the entry whose own hash is `hash`: a later line that names it as its `prev` is not. */
function holdsAsItsOwnHash(segment: string, hash: string): boolean {
  for (const line of segment.split('\n')) {
    if (!line.includes(hash)) continue;
    try {
      const entry = JSON.parse(line) as { link?: { hash?: unknown } };
      if (entry.link?.hash === hash) return true;
    } catch {
      // A line that does not parse is not an entry.
    }
  }
  return false;
}
