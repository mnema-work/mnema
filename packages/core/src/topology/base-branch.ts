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

/**
 * The branch a worktree has checked out, or undefined for a detached HEAD or where it cannot be said.
 * Read from the worktree's `HEAD` file; a repository kept in the `reftable` format writes the stub
 * `refs/heads/.invalid` there in every worktree, whatever the branch, so there git is asked
 * (`symbolic-ref`, within the same bounded time), and where it does not answer the HEAD counts as
 * detached, which asks the base branch (the side that cannot conflict).
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
  return ref.startsWith('refs/heads/') ? ref.slice('refs/heads/'.length) : undefined;
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
